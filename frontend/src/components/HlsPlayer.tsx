"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function HlsPlayer({
	src,
	poster,
}: {
	src: string;
	poster?: string;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video || !src) return;

		if (video.canPlayType("application/vnd.apple.mpegurl")) {
			video.src = src;
			return;
		}

		if (Hls.isSupported()) {
			const hls = new Hls({
				lowLatencyMode: true,
				enableWorker: true,
			});
			hls.loadSource(src);
			hls.attachMedia(video);
			return () => hls.destroy();
		}

		video.src = src;
	}, [src]);

	return (
		<video
			ref={videoRef}
			className="w-full h-full"
			controls
			playsInline
			autoPlay
			muted
			poster={poster}
		/>
	);
}
