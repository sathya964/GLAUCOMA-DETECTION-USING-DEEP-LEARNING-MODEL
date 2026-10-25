import { GoogleGenAI } from "@google/genai";
import type { Config } from "@netlify/functions";

const SYSTEM_PROMPT =
  "You are a helpful assistant embedded in ClearSight, a retinal glaucoma " +
  "screening web app. You answer questions about glaucoma, eye health terms " +
  "(like IOP, cup-to-disc ratio, optic nerve health), and help users understand " +
  "their screening result in plain language. You are NOT a doctor and must never " +
  "give a diagnosis or tell someone what to do instead of seeing a doctor. Always " +
  "encourage users with concerning results to see an eye care professional. Keep " +
  "answers concise and friendly.";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let message = "";
  let resultContext: string | null = null;
  try {
    const data = await req.json();
    message = String(data.message ?? "").trim().slice(0, 2000);
    resultContext = data.result_context ? String(data.result_context).slice(0, 500) : null;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  let systemPrompt = SYSTEM_PROMPT;
  if (resultContext) {
    systemPrompt += `\n\nThe user's most recent screening result: ${resultContext}`;
  }

  try {
    const ai = new GoogleGenAI({});
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message,
      config: { systemInstruction: systemPrompt },
    });
    return Response.json({ reply: response.text });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "The assistant is unavailable right now." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/chat",
};
