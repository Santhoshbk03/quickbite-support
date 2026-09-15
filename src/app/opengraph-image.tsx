import { ImageResponse } from "next/og";

export const alt = "QuickBite Support: order help and policy answers, with sources.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Satori does not understand oklch; these are the sRGB equivalents of the dark theme tokens. */
const CANVAS = "#1b1815";
const SURFACE = "#25211d";
const SURFACE_3 = "#312c27";
const LINE = "rgba(250, 238, 222, 0.12)";
const FG = "#f5f1ea";
const MUTED = "#cdc4b8";
const SUBTLE = "#9d9387";
const BRAND = "#eeab45";
const DANGER = "#f08a70";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: CANVAS,
        backgroundImage: `radial-gradient(${LINE} 1.4px, transparent 1.6px)`,
        backgroundSize: "26px 26px",
        padding: "64px",
        color: FG,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: "55%", paddingRight: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "999px",
              background: BRAND,
              display: "flex",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                width: "20px",
                height: "20px",
                borderRadius: "999px",
                background: CANVAS,
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: "30px", fontWeight: 700 }}>QuickBite</div>
          <div style={{ display: "flex", fontSize: "24px", color: SUBTLE }}>Support</div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "64px",
            fontSize: "18px",
            letterSpacing: "3px",
            color: SUBTLE,
          }}
        >
          CUSTOMER SUPPORT DEMO
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "18px",
            fontSize: "66px",
            lineHeight: 1.05,
            fontWeight: 600,
            letterSpacing: "-2px",
          }}
        >
          <div style={{ display: "flex" }}>Order help and</div>
          <div style={{ display: "flex" }}>
            <span style={{ color: BRAND }}>policy answers.</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "28px",
            fontSize: "24px",
            lineHeight: 1.45,
            color: MUTED,
          }}
        >
          Chat with a support assistant, track orders, and read the policy behind every answer.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "45%",
          alignSelf: "center",
          background: SURFACE,
          border: `1px solid ${LINE}`,
          borderRadius: "22px",
          padding: "28px",
          gap: "20px",
          boxShadow: "0 30px 60px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              background: SURFACE_3,
              borderRadius: "16px",
              padding: "12px 18px",
              fontSize: "20px",
            }}
          >
            Where is my order QB-2026-481213?
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "20px" }}>
          <div style={{ display: "flex", color: FG }}>
            On the way with Ravi, about 11 minutes away.
          </div>
          <div style={{ display: "flex", color: MUTED }}>• Promised at checkout: 7:25 PM</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: `1px solid ${LINE}`,
            borderRadius: "14px",
            padding: "14px 18px",
            fontSize: "18px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: FG, fontWeight: 600 }}>Dosa Republic</span>
            <span style={{ color: SUBTLE }}>3 items · ₹586</span>
          </div>
          <div
            style={{
              display: "flex",
              color: DANGER,
              border: `1px solid ${DANGER}`,
              borderRadius: "999px",
              padding: "4px 12px",
            }}
          >
            28 min late
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "16px" }}>
          <span style={{ color: SUBTLE, letterSpacing: "2px" }}>SOURCES</span>
          <span
            style={{
              display: "flex",
              color: BRAND,
              border: `1px solid ${LINE}`,
              borderRadius: "999px",
              padding: "4px 12px",
            }}
          >
            Late Delivery Compensation
          </span>
        </div>
      </div>
    </div>,
    size,
  );
}
