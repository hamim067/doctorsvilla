// ভিডিওর লিংক চেনা — YouTube, Facebook, Vimeo; সার্ভার আর ব্রাউজার দুজনেই ব্যবহার করে
export type VideoInfo = { kind: "youtube" | "facebook" | "vimeo"; embed: string; thumb: string | null; label: string };

export function parseVideo(raw: string): VideoInfo | null {
  const s = raw.trim();
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  // YouTube: watch?v=, youtu.be/, shorts/, embed/, live/
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    yt = u.searchParams.get("v") ?? (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] ?? null);
  }
  if (yt && /^[\w-]{6,20}$/.test(yt)) {
    return { kind: "youtube", embed: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, label: "YouTube" };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    if (id) return { kind: "vimeo", embed: `https://player.vimeo.com/video/${id}?autoplay=1`, thumb: null, label: "Vimeo" };
  }
  if (host === "facebook.com" || host === "fb.watch" || host === "web.facebook.com") {
    if (host === "fb.watch" || /\/videos\/|\/watch|\/reel\//.test(u.pathname + u.search)) {
      return { kind: "facebook", embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(s)}&show_text=false&autoplay=true`, thumb: null, label: "Facebook" };
    }
  }
  return null;
}
