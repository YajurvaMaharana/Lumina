import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp({ projectId: "gen-lang-client-0576077491" });

async function makeAdmin() {
  const email = "valentinine14feb@gmail.com";
  try {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`Successfully made ${email} an admin!`);
  } catch (error) {
    console.error("Error making user admin:", error);
  }
}

makeAdmin();
