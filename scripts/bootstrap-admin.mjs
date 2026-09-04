import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import process from "node:process";

try {
  process.loadEnvFile?.(".env.local");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

function hiddenPinPrompt(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Hidden PIN input requires an interactive terminal");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    let finished = false;
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function finish(error) {
      if (finished) return;
      finished = true;
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Bootstrap cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (/^[0-9]$/.test(character) && value.length < 4) {
          value += character;
          process.stdout.write("*");
        }
      }
    }

    process.stdin.on("data", onData);
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
}

const reader = createInterface({ input: process.stdin, output: process.stdout });
const displayName = (await reader.question("ชื่อ Admin คนแรก: ")).trim();
reader.close();
const temporaryPin = await hiddenPinPrompt("PIN ชั่วคราว 4 หลัก: ");
if (!displayName || !/^\d{4}$/.test(temporaryPin)) {
  throw new Error("Admin name is required and the temporary PIN must contain four digits");
}

const client = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await client.rpc("bootstrap_first_admin", {
  p_display_name: displayName,
  p_temporary_pin: temporaryPin,
});
if (error) throw error;
if (!data?.ok) throw new Error(data?.error?.message ?? "Admin bootstrap failed");

process.stdout.write(`สร้าง Admin ${data.admin.display_name} แล้ว กรุณาเปลี่ยน PIN เมื่อเข้าสู่ระบบ\n`);
