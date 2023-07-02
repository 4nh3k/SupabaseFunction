import { serve } from "std/server";
import * as postgres from "postgres";

console.log("Hello from Functions!");

type MessageRecord = {
  id: string;
  message: string;
  sent_at: string;
  sender_id: string;
  conversation_id: string;
  message_type: string;
  images: string[];
};

const apiKey = Deno.env.get("ONESIGNAL_API_KEY")!;
const appId = Deno.env.get('ONESIGNAL_APP_ID')!;
const databaseUrl = Deno.env.get("DATABASE_URL")!;
const apiUrl = Deno.env.get("API_URL")!;
const pool = new postgres.Pool(databaseUrl, 3, true);

console.log(apiKey);
console.log(appId);
console.log(apiUrl);
console.log(databaseUrl);

const sendNotification = async (record: MessageRecord) => {

  try {
    // Grab a connection from the pool
    const connection = await pool.connect();

    try {
      // Run a query
      const user_info = await connection.queryObject`SELECT full_name FROM user_info WHERE uid = ${record.sender_id}`;
      const userFullName = user_info.rows[0].full_name;

      const conversation_infor = await connection.queryObject`SELECT user1_id, user2_id FROM conversations WHERE id = ${record.conversation_id}`;
      const uid1 = conversation_infor.rows[0].user1_id;
      const uid2 = conversation_infor.rows[0].user2_id;
      let noti = record.message;
      let imageUrl = record.images[0];
      if(record.message_type === 'images')
      {
        noti = `${userFullName} đã gửi ảnh cho bạn`;
      }
      if(record.message_type === 'location')
      {
        noti = `${userFullName} đã vị trí cho bạn`;
      }
      if(record.message_type === 'post')
      {
        noti = `${userFullName} đã một bài viết cho bạn`;
      }
      // Return the response with the correct content type header
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          app_id: appId,
          include_external_user_ids: [(record.sender_id === uid1) ? uid2 : uid1],
          headings: { en: userFullName },
          contents: { en: noti },
          big_picture: imageUrl,
          android_group: record.sender_id,
          data: { uid: record.sender_id}
        }),
      });
    
      const jsonResponse = await response.json();
      return new Response(
        JSON.stringify(jsonResponse),
        {
          headers: { "Content-Type": "application/json" },
        },
      );

    } finally {
      // Release the connection back into the pool
      connection.release();
    }
  } catch(err) {
    console.error(err);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
};

serve(async (req) => {
  const { record } = await req.json();

  const messageRecord: MessageRecord = {
    id: record?.id ?? "",
    message: record?.message ?? "",
    sent_at: record?.sent_at ?? "",
    sender_id: record?.sender_id ?? "",
    conversation_id: record?.conversation_id ?? "",
    message_type: record?.message_type ?? "",
    images: record?.images ?? [],
  };

  const response = await sendNotification(messageRecord);
  return response;
});
