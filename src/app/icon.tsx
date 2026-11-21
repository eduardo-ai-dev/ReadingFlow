import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#050609",
          border: "12px solid #C4A77D",
          borderRadius: "80px",
          color: "#C4A77D",
          fontFamily: "serif",
          boxShadow: "inset 0 0 40px rgba(196,167,125,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 220,
            fontWeight: 700,
            letterSpacing: -6,
            color: "#F4EFE6",
            textShadow: "0 8px 24px rgba(0,0,0,0.8)",
          }}
        >
          RF
        </div>
        <div
          style={{
            fontSize: 32,
            letterSpacing: 10,
            textTransform: "uppercase",
            color: "#C4A77D",
            marginTop: -10,
          }}
        >
          ReadingFlow
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

