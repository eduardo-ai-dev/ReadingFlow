import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ variant: string }>;
};

export async function GET(_request: Request, context: RouteParams) {
  const { variant } = await context.params;
  if (variant !== "192" && variant !== "512" && variant !== "maskable-512") {
    return NextResponse.json(
      { error: "Ícone não encontrado." },
      { status: 404 }
    );
  }

  const isSmall = variant === "192";
  const isMaskable = variant === "maskable-512";
  const dim = isSmall ? 192 : 512;
  const fontSize = isMaskable ? 168 : isSmall ? 84 : 220;
  const subSize = isMaskable ? 24 : isSmall ? 14 : 32;
  const borderW = isMaskable ? 0 : isSmall ? 6 : 12;
  const radius = isMaskable ? 0 : isSmall ? 32 : 80;

  const img = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#141514",
        border: borderW ? `${borderW}px solid #C8A46E` : "none",
        borderRadius: `${radius}px`,
        padding: isMaskable ? "72px" : "0px",
        color: "#C8A46E",
        fontFamily: "serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize,
          fontWeight: 700,
          letterSpacing: isSmall ? -2 : -6,
          color: "#F4EFE6",
        }}
      >
        RF
      </div>
      <div
        style={{
          fontSize: subSize,
          letterSpacing: isSmall ? 4 : 10,
          textTransform: "uppercase",
          color: "#C8A46E",
          marginTop: isSmall ? -4 : -10,
        }}
      >
        ReadingFlow
      </div>
    </div>,
    {
      width: dim,
      height: dim,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );

  return img;
}
