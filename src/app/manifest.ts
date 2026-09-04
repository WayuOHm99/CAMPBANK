import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EQ-BANK — ระบบคะแนนกิจกรรมค่าย",
    short_name: "EQ-BANK",
    description: "ให้คะแนนกลุ่ม ติดตามงบ และดูอันดับกิจกรรมค่าย",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#205E91",
    lang: "th",
    icons: [
      {
        src: "/brand/logo-eqcamp.jpg",
        sizes: "700x700",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
