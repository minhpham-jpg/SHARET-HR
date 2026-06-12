exports.handler = async (event) => {
  // Handle CORS preflight — browser gửi OPTIONS trước khi POST thật
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "GEMINI_API_KEY chưa được cấu hình trong Netlify Environment Variables." })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { system, messages, max_tokens } = body;

    // Convert Anthropic-style messages sang Gemini format
    const geminiContents = [];
    if (system) {
      geminiContents.push({ role: "user", parts: [{ text: "[System]: " + system }] });
      geminiContents.push({ role: "model", parts: [{ text: "Hiểu rồi, tôi sẽ tuân theo hướng dẫn đó." }] });
    }
    for (const m of messages) {
      geminiContents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: max_tokens || 1000,
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    // Nếu Gemini trả lỗi, log ra để dễ debug
    if (!response.ok) {
      return {
        statusCode: 200, // trả 200 để HTML không crash, nhưng báo lỗi trong text
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          content: [{ type: "text", text: `Lỗi Gemini API: ${data?.error?.message || JSON.stringify(data)}` }]
        })
      };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Xin lỗi, không có phản hồi.";

    // Trả về Anthropic-compatible format để HTML không cần đổi gì
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        content: [{ type: "text", text }]
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
