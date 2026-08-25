import { World } from "@/game/World";
import { logout } from "@/lib/auth/actions";
import { getViewer, isSignedIn } from "@/lib/auth/dal";
import { getWorld } from "@/lib/world/query";

export default async function Home() {
  // No login required: an anonymous visitor is treated as the player, so she
  // can open the link and simply walk in.
  const viewer = await getViewer();
  const [spots, signedIn] = await Promise.all([getWorld(viewer.id), isSignedIn()]);

  return (
    <div className="absolute inset-0">
      <World
        spots={spots}
        isAdmin={signedIn && viewer.role === "ADMIN"}
        signedIn={signedIn}
        logout={logout}
      />
    </div>
  );
}
