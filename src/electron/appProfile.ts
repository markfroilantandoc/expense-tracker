import { app } from 'electron';
import path from 'node:path';

export type AppProfile = 'dev' | 'prod';

export type AppEnvironment = {
  profile: AppProfile;
  userDataPath: string;
};

const validProfiles: AppProfile[] = ['dev', 'prod'];

export function getAppProfile(): AppProfile {
  const requestedProfile = process.env.EXPENSE_TRACKER_PROFILE;

  if (requestedProfile && isAppProfile(requestedProfile)) {
    return requestedProfile;
  }

  return app.isPackaged ? 'prod' : 'dev';
}

export function configureProfileUserDataPath(profile: AppProfile): string {
  const userDataPath = path.join(app.getPath('appData'), `expense-tracker-${profile}`);
  app.setPath('userData', userDataPath);
  return userDataPath;
}

export function getAppEnvironment(): AppEnvironment {
  return {
    profile: getAppProfile(),
    userDataPath: app.getPath('userData'),
  };
}

export function isProductionProfile(profile: AppProfile): boolean {
  return profile === 'prod';
}

function isAppProfile(value: string): value is AppProfile {
  return validProfiles.includes(value as AppProfile);
}
