import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, fileBase64, fileName, fileType } = body;

  // Upload file if provided
  let uploadFileId: string | null = null;
  if (fileBase64 && fileName) {
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const formData = new FormData();
    const blob = new Blob([buffer], { type: fileType || "application/pdf" });
    formData.append("file", blob, fileName);
    formData.append("user", "paper-pulse-user");

    const uploadRes = await fetch(`${process.env.DIFY_API_BASE}/files/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` },
      body: formData,
    });
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      uploadFileId = uploadData.id;
    }
  }

  const today = new Date().toISOString().split("T")[0];

  const payload = {
    inputs: {
      current_date: today,
      ...(uploadFileId
        ? { uploads: [{ transfer_method: "local_file", type: "document", upload_file_id: uploadFileId }] }
        : {}),
    },
    query,
    response_mode: "blocking",
    user: "paper-pulse-user",
    conversation_id: "",
  };

  const difyRes = await fetch(`${process.env.DIFY_API_BASE}/chat-messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!difyRes.ok) {
    const err = await difyRes.text();
    return Response.json({ error: err }, { status: 500 });
  }

  const data = await difyRes.json();
  const answer = data.answer ?? "";

  return Response.json({ answer });
}
