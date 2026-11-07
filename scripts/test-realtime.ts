import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function testRealtimeBroadcast() {
  console.log("=== TESTING SUPABASE REALTIME MULTI-CLIENT BUS ===\n");

  // Client A simulates the customer's phone browser
  const clientA = createClient(SUPABASE_URL, ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });

  // Client B simulates the Control Room (Kitchen Kanban / Cashier)
  const clientB = createClient(SUPABASE_URL, ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });

  let messageReceivedByClientB = false;
  let receivedPayload: unknown = null;

  const channelB = clientB.channel("tbw-cafe-orders-test");
  channelB.on("broadcast", { event: "NEW_ORDER" }, (payload) => {
    messageReceivedByClientB = true;
    receivedPayload = payload;
  });

  await channelB.subscribe();

  const channelA = clientA.channel("tbw-cafe-orders-test");
  await channelA.subscribe();

  // Give subscription a moment to connect
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Client A broadcasts an order placement event
  const testPayload = {
    orderNumber: "#TBW-TEST-REALTIME",
    tableCode: "04",
    totalAmount: 480,
    timestamp: Date.now(),
  };

  await channelA.send({
    type: "broadcast",
    event: "NEW_ORDER",
    payload: testPayload,
  });

  // Wait for delivery to Client B
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("Realtime delivery result:", {
    received: messageReceivedByClientB,
    payload: receivedPayload,
  });

  await clientA.removeChannel(channelA);
  await clientB.removeChannel(channelB);

  process.exit(messageReceivedByClientB ? 0 : 1);
}

testRealtimeBroadcast().catch((err) => {
  console.error("Realtime test error:", err);
  process.exit(1);
});

