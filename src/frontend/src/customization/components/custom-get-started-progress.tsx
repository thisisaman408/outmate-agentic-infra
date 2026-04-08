import type { Users } from "@/types/api";

export function CustomGetStartedProgress({
  userData,
  isGithubStarred,
  isDiscordJoined,
  handleDismissDialog,
}: {
  userData: Users;
  isGithubStarred: boolean;
  isDiscordJoined: boolean;
  handleDismissDialog: () => void;
}) {
  // Disabled — no GitHub/Discord prompts for Outmate users
  return null;
}

export default CustomGetStartedProgress;
