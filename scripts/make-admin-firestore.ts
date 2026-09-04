import { Firestore } from "@google-cloud/firestore";

const db = new Firestore({
  projectId: "gen-lang-client-0576077491",
  databaseId: "ai-studio-7c3fd21d-d7a4-4494-b572-5a5a5902d114"
});

async function makeAdmin() {
  try {
    const dbRef = db.collection("admins").doc("valentinine14feb@gmail.com");
    await dbRef.set({ isAdmin: true, createdAt: new Date() });
    console.log("Admin doc created successfully!");
  } catch (error) {
    console.error("Error writing admin doc:", error);
  }
}

makeAdmin();
