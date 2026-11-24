/** Throwaway inbox providers, used to farm free accounts. Checked at sign-up only. */
const DISPOSABLE = new Set([
  "0-mail.com", "10minutemail.com", "10minutemail.net", "10minemail.com", "20minutemail.com", "33mail.com",
  "anonbox.net", "anonymbox.com", "burnermail.io", "byom.de", "chacuo.net", "cool.fr.nf", "correotemporal.org",
  "crazymailing.com", "dispostable.com", "discard.email", "dropmail.me", "emailondeck.com", "emailfake.com",
  "emailtemporanea.net", "fakeinbox.com", "fakemail.net", "fakemailgenerator.com", "getairmail.com", "getnada.com",
  "guerrillamail.biz", "guerrillamail.com", "guerrillamail.de", "guerrillamail.info", "guerrillamail.net",
  "guerrillamail.org", "guerrillamailblock.com", "harakirimail.com", "inboxbear.com", "inboxkitten.com",
  "jetable.org", "linshiyouxiang.net", "luxusmail.org", "mail-temp.com", "mail.tm", "mail7.io", "mailcatch.com",
  "maildrop.cc", "mailinator.com", "mailinator.net", "mailnesia.com", "mailpoof.com", "mailsac.com", "mintemail.com",
  "moakt.com", "mohmal.com", "mytemp.email", "nada.email", "nowmymail.com", "one-time.email", "sharklasers.com",
  "spam4.me", "spambog.com", "spamgourmet.com", "temp-mail.io", "temp-mail.org", "tempail.com", "tempinbox.com",
  "tempmail.com", "tempmail.dev", "tempmail.net", "tempmail.plus", "tempmailo.com", "tempr.email", "throwawaymail.com",
  "tmail.ws", "tmailor.com", "tmpmail.net", "tmpmail.org", "trashmail.com", "trashmail.de", "trashmail.net",
  "wegwerfmail.de", "yopmail.com", "yopmail.fr", "yopmail.net", "zetmail.com",
]);

export function isDisposableEmail(email: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  return DISPOSABLE.has(domain);
}

export const DISPOSABLE_MESSAGE = "Please use a permanent email address, like Gmail, Outlook or your school email.";
