import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  avatarUrl?: string | null;
  fullName?: string | null;
  email?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({
  avatarUrl,
  fullName,
  email,
  className,
  size = "md",
}: UserAvatarProps) {
  const getInitials = () => {
    if (fullName) {
      return fullName.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "??";
  };

  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={avatarUrl || undefined} alt={fullName || email || "User"} />
      <AvatarFallback className={cn(sizeClasses[size].split(" ").pop())}>
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}
