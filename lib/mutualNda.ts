/**
 * Mutual NDA document builder.
 *
 * `RAW_STANDARD_TERMS` is copied verbatim from `templates/mutual-nda.md`
 * (Common Paper Mutual NDA Standard Terms, Version 1.0). The only transform
 * applied is stripping the inline `<span class="coverpage_link">…</span>`
 * wrappers so the text renders cleanly as plain Markdown; see
 * `STANDARD_TERMS_MD` below. The heading is also demoted from `#` to `##` so
 * it nests under the assembled agreement.
 *
 * Common Paper Mutual Non-Disclosure Agreement (Version 1.0) is free to use
 * under CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
 */

export type MndaTermKind = "years" | "until_terminated";
export type ConfidentialityTermKind = "years" | "perpetuity";

export interface PartyDetails {
  /** Printed name of the signatory. */
  name: string;
  title: string;
  company: string;
  /** Email or postal address for notices. */
  noticeAddress: string;
}

export interface NdaFormValues {
  purpose: string;
  /** ISO `yyyy-mm-dd`. */
  effectiveDate: string;
  mndaTermKind: MndaTermKind;
  mndaTermYears: number;
  confidentialityTermKind: ConfidentialityTermKind;
  confidentialityTermYears: number;
  /** US state whose law governs. */
  governingLaw: string;
  /** City/county and state for jurisdiction, e.g. "New Castle, Delaware". */
  jurisdiction: string;
  /** Free-text list of modifications; empty means "None." */
  modifications: string;
  party1: PartyDetails;
  party2: PartyDetails;
}

export interface FieldError {
  field: string;
  message: string;
}

const emptyParty = (): PartyDetails => ({
  name: "",
  title: "",
  company: "",
  noticeAddress: "",
});

export const DEFAULT_VALUES: NdaFormValues = {
  purpose:
    "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTermKind: "years",
  mndaTermYears: 1,
  confidentialityTermKind: "years",
  confidentialityTermYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: emptyParty(),
  party2: emptyParty(),
};

/** Format an ISO `yyyy-mm-dd` string as e.g. "January 2, 2026" (UTC, locale-stable). */
export function formatEffectiveDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "[Effective Date]";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "[Effective Date]";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function positiveYears(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 1;
}

export function validate(values: NdaFormValues): FieldError[] {
  const errors: FieldError[] = [];
  const require = (field: string, value: string, label: string) => {
    if (!value.trim()) errors.push({ field, message: `${label} is required.` });
  };

  require("purpose", values.purpose, "Purpose");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.effectiveDate)) {
    errors.push({ field: "effectiveDate", message: "A valid effective date is required." });
  }
  require("governingLaw", values.governingLaw, "Governing law");
  require("jurisdiction", values.jurisdiction, "Jurisdiction");

  if (values.mndaTermKind === "years" && !positiveYears(values.mndaTermYears)) {
    errors.push({ field: "mndaTermYears", message: "MNDA term must be a whole number of years (1 or more)." });
  }
  if (
    values.confidentialityTermKind === "years" &&
    !positiveYears(values.confidentialityTermYears)
  ) {
    errors.push({
      field: "confidentialityTermYears",
      message: "Term of confidentiality must be a whole number of years (1 or more).",
    });
  }

  ([
    ["party1", values.party1, "Party 1"],
    ["party2", values.party2, "Party 2"],
  ] as const).forEach(([key, party, label]) => {
    require(`${key}.name`, party.name, `${label} name`);
    require(`${key}.company`, party.company, `${label} company`);
    require(`${key}.noticeAddress`, party.noticeAddress, `${label} notice address`);
  });

  return errors;
}

/** Make user text safe to drop into a single Markdown table cell. */
function cell(value: string): string {
  const clean = value.replace(/\r?\n+/g, " ").replace(/\|/g, "\\|").trim();
  return clean.length > 0 ? clean : " ";
}

function years(value: number): string {
  return Number.isFinite(value) ? String(value) : "[number of]";
}

function mndaTermSentence(values: NdaFormValues): string {
  return values.mndaTermKind === "years"
    ? `Expires ${years(values.mndaTermYears)} year(s) from the Effective Date.`
    : "Continues until terminated in accordance with the terms of the MNDA.";
}

function confidentialityTermSentence(values: NdaFormValues): string {
  return values.confidentialityTermKind === "years"
    ? `${years(values.confidentialityTermYears)} year(s) from the Effective Date, but in the case of trade secrets, until the Confidential Information is no longer considered a trade secret under applicable laws.`
    : "In perpetuity.";
}

export function buildCoverPage(values: NdaFormValues): string {
  const modifications = values.modifications.trim() || "None.";

  return `# Mutual Non-Disclosure Agreement

## Cover Page

This Mutual Non-Disclosure Agreement (the "MNDA") consists of: (1) this Cover Page and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 ("Standard Terms") identical to those posted at https://commonpaper.com/standards/mutual-nda/1.0. Any modifications of the Standard Terms should be made on this Cover Page, which will control over conflicts with the Standard Terms.

### Purpose

${values.purpose.trim() || "[Purpose]"}

### Effective Date

${formatEffectiveDate(values.effectiveDate)}

### MNDA Term

${mndaTermSentence(values)}

### Term of Confidentiality

${confidentialityTermSentence(values)}

### Governing Law & Jurisdiction

Governing Law: ${values.governingLaw.trim() || "[State]"}

Jurisdiction: courts located in ${values.jurisdiction.trim() || "[city or county and state]"}

### MNDA Modifications

${modifications}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

| | Party 1 | Party 2 |
| :-- | :-- | :-- |
| Signature | | |
| Print Name | ${cell(values.party1.name)} | ${cell(values.party2.name)} |
| Title | ${cell(values.party1.title)} | ${cell(values.party2.title)} |
| Company | ${cell(values.party1.company)} | ${cell(values.party2.company)} |
| Notice Address | ${cell(values.party1.noticeAddress)} | ${cell(values.party2.noticeAddress)} |
| Date | | |`;
}

const RAW_STANDARD_TERMS = `# Standard Terms

1. **Introduction**. This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page (defined below)) (“**MNDA**”) allows each party (“**Disclosing Party**”) to disclose or make available information in connection with the <span class="coverpage_link">Purpose</span> which (1) the Disclosing Party identifies to the receiving party (“**Receiving Party**”) as “confidential”, “proprietary”, or the like or (2) should be reasonably understood as confidential or proprietary due to its nature and the circumstances of its disclosure (“**Confidential Information**”). Each party’s Confidential Information also includes the existence and status of the parties’ discussions and information on the Cover Page. Confidential Information includes technical or business information, product designs or roadmaps, requirements, pricing, security and compliance documentation, technology, inventions and know-how. To use this MNDA, the parties must complete and sign a cover page incorporating these Standard Terms (“**Cover Page**”). Each party is identified on the Cover Page and capitalized terms have the meanings given herein or on the Cover Page.

2. **Use and Protection of Confidential Information**. The Receiving Party shall: (a) use Confidential Information solely for the <span class="coverpage_link">Purpose</span>; (b) not disclose Confidential Information to third parties without the Disclosing Party’s prior written approval, except that the Receiving Party may disclose Confidential Information to its employees, agents, advisors, contractors and other representatives having a reasonable need to know for the <span class="coverpage_link">Purpose</span>, provided these representatives are bound by confidentiality obligations no less protective of the Disclosing Party than the applicable terms in this MNDA and the Receiving Party remains responsible for their compliance with this MNDA; and (c) protect Confidential Information using at least the same protections the Receiving Party uses for its own similar information but no less than a reasonable standard of care.

3. **Exceptions**. The Receiving Party’s obligations in this MNDA do not apply to information that it can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it rightfully knew or possessed prior to receipt from the Disclosing Party without confidentiality restrictions; (c) it rightfully obtained from a third party without confidentiality restrictions; or (d) it independently developed without using or referencing the Confidential Information.

4. **Disclosures Required by Law**. The Receiving Party may disclose Confidential Information to the extent required by law, regulation or regulatory authority, subpoena or court order, provided (to the extent legally permitted) it provides the Disclosing Party reasonable advance notice of the required disclosure and reasonably cooperates, at the Disclosing Party’s expense, with the Disclosing Party’s efforts to obtain confidential treatment for the Confidential Information.

5. **Term and Termination**. This MNDA commences on the <span class="coverpage_link">Effective Date</span> and expires at the end of the <span class="coverpage_link">MNDA Term</span>. Either party may terminate this MNDA for any or no reason upon written notice to the other party. The Receiving Party’s obligations relating to Confidential Information will survive for the <span class="coverpage_link">Term of Confidentiality</span>, despite any expiration or termination of this MNDA.

6. **Return or Destruction of Confidential Information**. Upon expiration or termination of this MNDA or upon the Disclosing Party’s earlier request, the Receiving Party will: (a) cease using Confidential Information; (b) promptly after the Disclosing Party’s written request, destroy all Confidential Information in the Receiving Party’s possession or control or return it to the Disclosing Party; and (c) if requested by the Disclosing Party, confirm its compliance with these obligations in writing. As an exception to subsection (b), the Receiving Party may retain Confidential Information in accordance with its standard backup or record retention policies or as required by law, but the terms of this MNDA will continue to apply to the retained Confidential Information.

7. **Proprietary Rights**. The Disclosing Party retains all of its intellectual property and other rights in its Confidential Information and its disclosure to the Receiving Party grants no license under such rights.

8. **Disclaimer**. ALL CONFIDENTIAL INFORMATION IS PROVIDED “AS IS”, WITH ALL FAULTS, AND WITHOUT WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

9. **Governing Law and Jurisdiction**. This MNDA and all matters relating hereto are governed by, and construed in accordance with, the laws of the State of <span class="coverpage_link">Governing Law</span>, without regard to the conflict of laws provisions of such <span class="coverpage_link">Governing Law</span>. Any legal suit, action, or proceeding relating to this MNDA must be instituted in the federal or state courts located in <span class="coverpage_link">Jurisdiction</span>. Each party irrevocably submits to the exclusive jurisdiction of such <span class="coverpage_link">Jurisdiction</span> in any such suit, action, or proceeding.

10. **Equitable Relief**. A breach of this MNDA may cause irreparable harm for which monetary damages are an insufficient remedy. Upon a breach of this MNDA, the Disclosing Party is entitled to seek appropriate equitable relief, including an injunction, in addition to its other remedies.

11. **General**. Neither party has an obligation under this MNDA to disclose Confidential Information to the other or proceed with any proposed transaction. Neither party may assign this MNDA without the prior written consent of the other party, except that either party may assign this MNDA in connection with a merger, reorganization, acquisition or other transfer of all or substantially all its assets or voting securities. Any assignment in violation of this Section is null and void. This MNDA will bind and inure to the benefit of each party’s permitted successors and assigns. Waivers must be signed by the waiving party’s authorized representative and cannot be implied from conduct. If any provision of this MNDA is held unenforceable, it will be limited to the minimum extent necessary so the rest of this MNDA remains in effect. This MNDA (including the Cover Page) constitutes the entire agreement of the parties with respect to its subject matter, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, whether written or oral, regarding such subject matter. This MNDA may only be amended, modified, waived, or supplemented by an agreement in writing signed by both parties. Notices, requests and approvals under this MNDA must be sent in writing to the email or postal addresses on the Cover Page and are deemed delivered on receipt. This MNDA may be executed in counterparts, including electronic copies, each of which is deemed an original and which together form the same agreement.

Common Paper Mutual Non-Disclosure Agreement Version 1.0 (https://commonpaper.com/standards/mutual-nda/1.0/) free to use under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).`;

/** Standard Terms as clean Markdown: span wrappers removed, heading demoted to `##`. */
export const STANDARD_TERMS_MD = RAW_STANDARD_TERMS.replace(
  /<span class="coverpage_link">/g,
  "",
)
  .replace(/<\/span>/g, "")
  .replace(/^# Standard Terms$/m, "## Standard Terms");

/** Assemble the full agreement: filled Cover Page followed by the Standard Terms. */
export function buildAgreement(values: NdaFormValues): string {
  return `${buildCoverPage(values)}\n\n---\n\n${STANDARD_TERMS_MD}\n`;
}
