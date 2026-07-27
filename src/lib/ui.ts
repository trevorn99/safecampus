import type { CSSProperties } from "react";

export const centeredStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.75rem",
  textAlign: "center",
  padding: "2rem",
};

export const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  width: "320px",
  textAlign: "left",
};

export const errorStyle: CSSProperties = {
  color: "crimson",
};
