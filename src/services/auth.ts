import { auth, db } from '../config/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { releaseUsername } from './storage';

/**
 * Re-authenticates the current user with their password and then deletes their account.
 * This also deletes their user document from Firestore.
 * 
 * @param password The user's current password for confirmation.
 * @throws Error if re-authentication fails or deletion fails.
 */
export const deleteAccount = async (password: string): Promise<void> => {
    const user = auth.currentUser;

    if (!user || !user.email) {
        throw new Error('No authenticated user found.');
    }

    try {
        // 1. Create credential
        const credential = EmailAuthProvider.credential(user.email, password);

        // 2. Re-authenticate
        await reauthenticateWithCredential(user, credential);

        // 3. Delete User Data from Firestore (Clean up)
        const userDocRef = doc(db, 'users', user.uid);

        // Release Username if it exists
        if (user.displayName) {
            await releaseUsername(user.displayName);
        }

        await deleteDoc(userDocRef);

        // 4. Delete Auth User
        await deleteUser(user);

    } catch (error: any) {
        console.error('Error deleting account:', error);
        throw error;
    }
};

export const signOutUser = async (): Promise<void> => {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
};

/**
 * Updates the user's password after re-authenticating with their current password.
 */
export const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const user = auth.currentUser;

    if (!user || !user.email) {
        throw new Error('No authenticated user found.');
    }

    try {
        // 1. Re-authenticate
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // 2. Update Password
        // Note: updatePassword is imported from firebase/auth
        const { updatePassword } = require('firebase/auth');
        await updatePassword(user, newPassword);

    } catch (error: any) {
        console.error('Error updating password:', error);
        throw error;
    }
};
