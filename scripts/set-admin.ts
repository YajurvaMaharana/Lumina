import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Initialize using Google Cloud's Application Default Credentials
initializeApp({ projectId: "gen-lang-client-0576077491" });

async function setAdminClaim() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Usage: npx tsx scripts/set-admin.ts <UID>");
    process.exit(1);
  }

  try {
    // Assign the 'admin' custom claim
    await getAuth().setCustomUserClaims(uid, { admin: true });
    console.log(`Successfully assigned 'admin' claim to user: ${uid}`);
    
    // Optional: Verify the claim was set
    const user = await getAuth().getUser(uid);
    console.log("Current Custom Claims:", user.customClaims);
  } catch (error) {
    console.error("Failed to set admin claim:", error);
    process.exit(1);
  }
}

setAdminClaim();
