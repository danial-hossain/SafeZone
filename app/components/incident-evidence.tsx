"use client";

import { useEffect, useRef, useState } from "react";
import type { EvidenceItem, Incident, Location } from "@/lib/schemas";
import { createLocationEvidence } from "@/lib/incidents";
import { BrowserLocationService } from "@/lib/services/location";
import { capturePhoto, requestAudioStream, requestCameraStream, stopMediaStream } from "@/lib/services/evidence-capture";
import { deleteEvidenceMedia, readEvidenceMedia, saveEvidenceMedia } from "@/lib/services/evidence-media";

const locationService = new BrowserLocationService();

export function IncidentEvidence({ incident, onAdd, onRemoveLocation, onDeleteEvidence }: { incident: Incident; onAdd: (item: EvidenceItem, location?: Location) => void; onRemoveLocation: (incidentId: string) => void; onDeleteEvidence: (incidentId: string, evidenceId: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deletingEvidence, setDeletingEvidence] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current && cameraRef.current) videoRef.current.srcObject = cameraRef.current;
  }, [cameraActive]);

  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    void Promise.all(incident.evidence.filter((item) => item.localReference && (item.type === "IMAGE" || item.type === "AUDIO")).map(async (item) => {
      const blob = await readEvidenceMedia(item.localReference!);
      if (!blob || !active) return [item.id, ""] as const;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return [item.id, url] as const;
    })).then((entries) => { if (active) setMediaUrls(Object.fromEntries(entries.filter(([, url]) => url))); });
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [incident.evidence]);

  useEffect(() => () => {
    stopMediaStream(cameraRef.current);
    discardRecordingRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopMediaStream(audioRef.current);
  }, []);

  async function addMedia(type: "IMAGE" | "AUDIO", blob: Blob, capturedAt = new Date()) {
    const id = crypto.randomUUID();
    const localReference = `media:${id}`;
    const storageScope = await saveEvidenceMedia(localReference, blob);
    const item: EvidenceItem = { id, incidentId: incident.id, type, createdAt: capturedAt.toISOString(), localReference, metadata: { mimeType: blob.type || (type === "IMAGE" ? "image/jpeg" : "audio/webm"), storageScope } };
    onAdd(item);
    setMessage(storageScope === "browser storage" ? "Evidence saved in this browser only; it was not uploaded." : "Evidence is available only until this page session ends; it was not uploaded.");
  }

  async function beginCamera() {
    setMessage("");
    try { cameraRef.current = await requestCameraStream(); setCameraActive(true); }
    catch (error) { const denied = error instanceof DOMException && error.name === "NotAllowedError"; setMessage(denied ? "Camera permission was denied. You can continue without a photo." : error instanceof Error ? `${error.message} You can continue without a photo.` : "Camera is unavailable. You can continue without a photo."); }
  }

  async function takePhoto() {
    if (!videoRef.current) return;
    setBusy(true);
    try { const capturedAt = new Date(); const image = await capturePhoto(videoRef.current); await addMedia("IMAGE", image, capturedAt); closeCamera(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The photo could not be captured."); }
    finally { setBusy(false); }
  }

  function closeCamera() {
    stopMediaStream(cameraRef.current);
    cameraRef.current = null;
    setCameraActive(false);
  }

  async function beginAudioRecording() {
    setMessage("");
    try {
      const stream = await requestAudioStream();
      audioRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRecordingRef.current = false;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => { discardRecordingRef.current = true; setMessage("Audio recording failed. You can continue without audio evidence."); setRecording(false); stopMediaStream(audioRef.current); };
      recorder.onstop = () => {
        setRecording(false);
        stopMediaStream(audioRef.current);
        audioRef.current = null;
        if (discardRecordingRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) { setMessage("No audio was captured. You can try again or continue without it."); return; }
        setBusy(true);
        void addMedia("AUDIO", blob, new Date()).finally(() => setBusy(false));
      };
      recorder.start();
      setRecording(true);
    } catch (error) {
      stopMediaStream(audioRef.current);
      audioRef.current = null;
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setMessage(denied ? "Microphone permission was denied. You can continue without audio evidence." : error instanceof Error ? `${error.message} You can continue without audio evidence.` : "Microphone is unavailable. You can continue without audio evidence.");
    }
  }

  function stopRecording(discard = false) {
    discardRecordingRef.current = discard;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function deleteEvidence(item: EvidenceItem) {
    setDeletingEvidence(item.id);
    let mediaRemoved = true;
    if (item.localReference) {
      const removedFromBrowserStorage = await deleteEvidenceMedia(item.localReference);
      mediaRemoved = removedFromBrowserStorage || item.metadata?.storageScope === "this session only";
    }
    onDeleteEvidence(incident.id, item.id);
    setConfirmingDelete(null);
    setDeletingEvidence(null);
    setMessage(mediaRemoved
      ? "Evidence was deleted from this incident and its local media was removed."
      : "Evidence was removed from this incident, but browser media storage was unavailable for cleanup.");
  }

  async function attachLocation() {
    setMessage("");
    try {
      const location = await locationService.getCurrentLocation();
      if (!location) { setMessage("Location is unavailable. You can continue without location evidence."); return; }
      onAdd(createLocationEvidence(incident.id, location), location);
      setMessage("Location evidence attached to this incident in this browser. It was not shared.");
    } catch (error) { setMessage(error instanceof Error ? `${error.message} You can continue without location evidence.` : "Location is unavailable. You can continue without location evidence."); }
  }

  const reportEvidence = incident.evidence.find((item) => item.type === "TEXT" || item.type === "VOICE");
  const mediaEvidence = incident.evidence.filter((item) => item.type !== "TEXT" && item.type !== "VOICE");

  return <section className="card" aria-label="Incident evidence" style={{ marginTop: 16 }}>
    <div className="label">EVIDENCE · OPTIONAL</div>
    <p className="small">Capture only what you choose. Camera, microphone, and location are requested after you select an action. Photos and recorded audio stay in this browser and are not uploaded. Location stays local unless you explicitly include it in a trusted-contact message preview; no provider is configured in this build, so nothing is delivered. Your report or transcript is submitted for analysis only when you choose to submit it. Browser storage may be cleared; session-only media is lost when this page session ends.</p>
    {reportEvidence && <div className="incident-row"><span className="small"><strong>{reportEvidence.type === "VOICE" ? "Reviewed voice transcript" : "User-provided text"}</strong><br/>{new Date(reportEvidence.createdAt).toLocaleString()} · Attached to this incident</span><details style={{ marginLeft: "auto" }}><summary className="small">View text</summary><p className="small">{incident.summary}</p></details></div>}
    {incident.location && !incident.evidence.some((item) => item.type === "LOCATION") && <div className="incident-row"><span className="small">Existing incident location · stored locally</span><button className="btn btn-quiet" type="button" onClick={() => onRemoveLocation(incident.id)}>Remove location</button></div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {!cameraActive ? <button className="btn" type="button" disabled={busy || recording} onClick={() => void beginCamera()}>Capture Photo</button> : <><button className="btn btn-primary" type="button" disabled={busy} onClick={() => void takePhoto()}>Capture image</button><button className="btn btn-quiet" type="button" onClick={closeCamera}>Cancel camera</button></>}
      {!recording ? <button className="btn" type="button" disabled={busy || cameraActive} onClick={() => void beginAudioRecording()}>Record Audio</button> : <><button className="btn btn-primary" type="button" onClick={() => stopRecording()}>Stop and save audio</button><button className="btn btn-quiet" type="button" onClick={() => stopRecording(true)}>Discard recording</button></>}
      <button className="btn" type="button" disabled={busy || cameraActive || recording} onClick={() => void attachLocation()}>Attach current location</button>
    </div>
    {cameraActive && <div style={{ marginTop: 12 }}><video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" style={{ width: "100%", maxHeight: 320, borderRadius: 9, background: "#000" }}/><p className="small">Camera is on for preview. Capture a photo or cancel to turn it off.</p></div>}
    {mediaEvidence.map((item) => {
      const storedUrl = mediaUrls[item.id];
      const storageScope = item.metadata?.storageScope;
      const status = item.type === "NOTE" ? "Saved in incident record" : item.type === "LOCATION" ? "Coordinates attached locally" : storedUrl ? storageScope === "this session only" ? "Available this session only" : "Saved in this browser" : "Media file unavailable; incident metadata retained";
      const label = item.type === "IMAGE" ? "Camera photo" : item.type === "AUDIO" ? "Audio recording" : item.type === "LOCATION" ? "GPS location" : "Private note";
      const deletable = item.type === "IMAGE" || item.type === "AUDIO" || item.type === "NOTE";
      return <div className="incident-row" key={item.id}>
        <span className="small"><strong>{label}</strong><br/>{new Date(item.createdAt).toLocaleString()} · {status}{item.type === "NOTE" && <><br/>{String(item.metadata?.note ?? "")}</>}</span>
        {item.type === "IMAGE" && storedUrl && <a href={storedUrl} target="_blank" rel="noreferrer" className="btn">View photo</a>}
        {item.type === "AUDIO" && storedUrl && <audio controls src={storedUrl} aria-label="Recorded audio evidence"/>}
        {item.type === "LOCATION" && <><span className="small">{String(item.metadata?.latitude)}, {String(item.metadata?.longitude)}</span><button className="btn btn-quiet" type="button" onClick={() => onRemoveLocation(incident.id)}>Remove location</button></>}
        {deletable && <button className="btn btn-quiet" type="button" onClick={() => setConfirmingDelete(item.id)}>Delete</button>}
        {confirmingDelete === item.id && <div className="card" role="alertdialog" aria-label="Delete evidence confirmation" style={{ flexBasis: "100%", marginTop: 8 }}><p className="small">Delete this evidence?</p><button className="btn btn-danger" type="button" disabled={deletingEvidence === item.id} onClick={() => void deleteEvidence(item)}>{deletingEvidence === item.id ? "Deleting…" : "Delete"}</button><button className="btn btn-quiet" type="button" disabled={deletingEvidence === item.id} style={{ marginLeft: 8 }} onClick={() => setConfirmingDelete(null)}>Cancel</button></div>}
      </div>;
    })}
    {message && <p className="small" role="status" style={{ marginBottom: 0 }}>{message}</p>}
  </section>;
}
