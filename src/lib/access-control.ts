
import rules from './access-rules.json';

type AccessRuleSet = {
  role?: 'admin';
  allowed_patterns?: string[];
  allowed_studies?: string[];
};

export type AccessRules = {
  [requesterEmail: string]: AccessRuleSet;
};

/**
 * Checks if a requester has permission to access data for a target email based on local JSON rules.
 * @param requesterEmail The email of the user making the request (logged into the app).
 * @param targetEmail The email of the Withings user whose data is being requested.
 * @returns {Promise<boolean>} True if access is granted, false otherwise.
 */
export async function checkAccess(requesterEmail: string, targetEmail: string): Promise<boolean> {
  const userRules = (rules as AccessRules)[requesterEmail];

  if (!userRules) {
    console.log(`No access rules found for requester: ${requesterEmail}`);
    return false;
  }

  // First, check if the user has an 'admin' role.
  if (userRules.role === 'admin') {
    console.log(`Access GRANTED for '${requesterEmail}' as admin.`);
    return true;
  }

  // If not an admin, proceed with the pattern matching logic.
  const allowedPatterns = userRules.allowed_patterns || [];

  if (allowedPatterns.length === 0) {
    console.log(`No allowed_patterns defined for requester: ${requesterEmail}`);
    return false;
  }

  // Check if any of the allowed patterns match the target email.
  const isAllowed = allowedPatterns.some(pattern => {
    // Convert wildcard pattern to a regular expression
    // Escape special regex characters, then replace our wildcards
    const regexPattern = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^.]*') + '$';
    try {
        const regex = new RegExp(regexPattern);
        return regex.test(targetEmail);
    } catch (e) {
        console.error(`Invalid regex pattern generated from wildcard: '${pattern}'`, e);
        return false;
    }
  });

  if (isAllowed) {
    console.log(`Access GRANTED for '${requesterEmail}' to '${targetEmail}' based on patterns.`);
  } else {
    console.log(`Access DENIED for '${requesterEmail}' to '${targetEmail}'. No matching pattern found.`);
  }

  return isAllowed;
}
