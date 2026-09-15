import { ImageResponse } from "next/og";

export const alt = "QuickBite Support — answers from policy, or an honest no.";
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

const ROWS = [
  { title: "Late Delivery Compensation", distance: 0.238, state: "cited" },
  { title: "Late Delivery · exemptions", distance: 0.327, state: "cited" },
  { title: "Severe Weather & Disruptions", distance: 0.492, state: "unused" },
  { title: "Rider Conduct & Safety", distance: 0.612, state: "below" },
] as const;

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
      <div style={{ display: "flex", flexDirection: "column", width: "58%", paddingRight: "40px" }}>
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
            marginTop: "56px",
            fontSize: "18px",
            letterSpacing: "3px",
            color: SUBTLE,
          }}
        >
          RETRIEVAL-AUGMENTED SUPPORT AGENT
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "18px",
            fontSize: "68px",
            lineHeight: 1.04,
            fontWeight: 600,
            letterSpacing: "-2px",
          }}
        >
          <div style={{ display: "flex" }}>Answers from policy.</div>
          <div style={{ display: "flex" }}>
            <span style={{ color: SUBTLE }}>Or an honest&nbsp;</span>
            <span style={{ color: BRAND }}>no.</span>
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
          Every answer shows its sources, their distances, the tool calls, and where the
          milliseconds went.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "42%",
          alignSelf: "center",
          background: SURFACE,
          border: `1px solid ${LINE}`,
          borderRadius: "22px",
          padding: "28px",
          boxShadow: "0 30px 60px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px" }}>
          <span style={{ color: FG, fontWeight: 600 }}>Retrieval</span>
          <span style={{ color: SUBTLE }}>top-k 3 · cosine</span>
        </div>

        <div
          style={{
            display: "flex",
            position: "relative",
            marginTop: "30px",
            height: "10px",
            borderRadius: "999px",
            background: SURFACE_3,
          }}
        >
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              top: 0,
              height: "10px",
              width: "55%",
              borderRadius: "999px",
              background: "rgba(238,171,69,0.22)",
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: "55%",
              top: "-10px",
              width: "2px",
              height: "30px",
              background: BRAND,
            }}
          />
          {ROWS.map((row) => (
            <div
              key={row.title}
              style={{
                display: "flex",
                position: "absolute",
                left: `${row.distance * 100 - 1.4}%`,
                top: "-3px",
                width: "16px",
                height: "16px",
                borderRadius: "999px",
                border: `3px solid ${row.state === "below" ? SUBTLE : BRAND}`,
                background: row.state === "cited" ? BRAND : SURFACE,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "30px" }}>
          {ROWS.map((row) => (
            <div
              key={row.title}
              style={{ display: "flex", alignItems: "center", fontSize: "18px" }}
            >
              <div
                style={{
                  display: "flex",
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  marginRight: "12px",
                  background:
                    row.state === "cited" ? BRAND : row.state === "unused" ? MUTED : SURFACE_3,
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexGrow: 1,
                  color: row.state === "below" ? SUBTLE : MUTED,
                }}
              >
                {row.title}
              </div>
              <div style={{ display: "flex", color: row.state === "below" ? SUBTLE : FG }}>
                {row.distance.toFixed(3)}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "24px",
            paddingTop: "18px",
            borderTop: `1px solid ${LINE}`,
            fontSize: "16px",
            color: SUBTLE,
            justifyContent: "space-between",
          }}
        >
          <span>threshold ≤ 0.55</span>
          <span style={{ color: BRAND }}>2 cited · 1 unused · 1 below</span>
        </div>
      </div>
    </div>,
    size,
  );
}
