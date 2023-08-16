// Import necessary components and functions
import Link from 'next/link';
import { signIn, signOut, useSession } from "next-auth/react";

// Define the SideNav component
export function SideNav() {
    // Use the useSession() hook to get session data and status
    const { data: sessionData, status } = useSession();
    // Extract the user object from session data
    const user = sessionData?.user;

    return (
        // Navigation container
        <nav className="sticky top-0 px-2 py-4">
            {/* Navigation links */}
            <ul className="flex flex-col items-start gap-2 whitespace-nowrap">
                {/* Home link */}
                <li>
                    <Link href="/">Home</Link>
                </li>
                {/* Profile link (conditionally displayed) */}
                {user != null && (
                    <li>
                        <Link href={`/profiles/${user.id}`}>Profile</Link>
                    </li>
                )}
                {/* Login or Logout button (conditionally displayed) */}
                {status === "authenticated" ? (
                    <li>
                        {/* Logout button */}
                        <button onClick={() => void signOut()}>Log Out</button>
                    </li>
                ) : (
                    <li>
                        {/* Login button */}
                        <button onClick={() => void signIn()}>Log In</button>
                    </li>
                )}
            </ul>
        </nav>
    );
}
