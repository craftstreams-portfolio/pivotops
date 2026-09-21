export async function getUserAudioStream() {
  return await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
}

export function attachAudioStream(
  peer: RTCPeerConnection,
  stream: MediaStream
) {
  stream.getTracks().forEach((track) => {
    peer.addTrack(track, stream);
  });
}