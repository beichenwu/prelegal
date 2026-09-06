/**
 * The document library: each Common Paper agreement Prelegal can produce, its
 * fill-in field set, and the raw Markdown of its cover page + standard terms.
 *
 * Definitions live in `frontend/documents/*.json`; the `.md` files are imported
 * as raw strings (see `next.config.mjs`).
 */

import aiAddendum from "@/documents/ai-addendum.json";
import businessAssociateAgreement from "@/documents/business-associate-agreement.json";
import cloudServiceAgreement from "@/documents/cloud-service-agreement.json";
import dataProcessingAgreement from "@/documents/data-processing-agreement.json";
import designPartnerAgreement from "@/documents/design-partner-agreement.json";
import mutualNda from "@/documents/mutual-nda.json";
import partnershipAgreement from "@/documents/partnership-agreement.json";
import pilotAgreement from "@/documents/pilot-agreement.json";
import professionalServicesAgreement from "@/documents/professional-services-agreement.json";
import serviceLevelAgreement from "@/documents/service-level-agreement.json";
import softwareLicenseAgreement from "@/documents/software-license-agreement.json";

import aiAddendumCover from "@/templates/ai-addendum-cover.md";
import aiAddendumTerms from "@/templates/ai-addendum.md";
import baaCover from "@/templates/business-associate-agreement-cover.md";
import baaTerms from "@/templates/business-associate-agreement.md";
import csaCover from "@/templates/cloud-service-agreement-cover.md";
import csaTerms from "@/templates/cloud-service-agreement.md";
import dpaCover from "@/templates/data-processing-agreement-cover.md";
import dpaTerms from "@/templates/data-processing-agreement.md";
import dpaPartnerCover from "@/templates/design-partner-agreement-cover.md";
import dpaPartnerTerms from "@/templates/design-partner-agreement.md";
import mndaCover from "@/templates/mutual-nda-cover.md";
import mndaTerms from "@/templates/mutual-nda.md";
import partnershipCover from "@/templates/partnership-agreement-cover.md";
import partnershipTerms from "@/templates/partnership-agreement.md";
import pilotCover from "@/templates/pilot-agreement-cover.md";
import pilotTerms from "@/templates/pilot-agreement.md";
import psaCover from "@/templates/professional-services-agreement-cover.md";
import psaTerms from "@/templates/professional-services-agreement.md";
import slaCover from "@/templates/service-level-agreement-cover.md";
import slaTerms from "@/templates/service-level-agreement.md";
import slaLicenseCover from "@/templates/software-license-agreement-cover.md";
import slaLicenseTerms from "@/templates/software-license-agreement.md";

export interface DocField {
  name: string;
  label: string;
  hint: string;
}

export interface DocParty {
  key: string;
  label: string;
}

export interface DocDefinition {
  slug: string;
  label: string;
  description: string;
  termsFile: string;
  coverFile: string;
  parties: DocParty[];
  fields: DocField[];
}

export interface LegalDocument extends DocDefinition {
  /** Raw Markdown of the fill-in cover page, with `{{token}}` placeholders. */
  coverText: string;
  /** Raw Markdown of the Common Paper standard terms. */
  termsText: string;
}

const SOURCES: Array<[DocDefinition, string, string]> = [
  [mutualNda, mndaCover, mndaTerms],
  [cloudServiceAgreement, csaCover, csaTerms],
  [serviceLevelAgreement, slaCover, slaTerms],
  [dataProcessingAgreement, dpaCover, dpaTerms],
  [designPartnerAgreement, dpaPartnerCover, dpaPartnerTerms],
  [professionalServicesAgreement, psaCover, psaTerms],
  [partnershipAgreement, partnershipCover, partnershipTerms],
  [businessAssociateAgreement, baaCover, baaTerms],
  [softwareLicenseAgreement, slaLicenseCover, slaLicenseTerms],
  [pilotAgreement, pilotCover, pilotTerms],
  [aiAddendum, aiAddendumCover, aiAddendumTerms],
];

export const DOCUMENTS: LegalDocument[] = SOURCES.map(
  ([def, coverText, termsText]) => ({ ...def, coverText, termsText }),
);

const BY_SLUG = new Map(DOCUMENTS.map((d) => [d.slug, d]));

export function getDocument(slug: string): LegalDocument | undefined {
  return BY_SLUG.get(slug);
}

/** Lightweight list for the triage step and the marketing catalogue. */
export const DOCUMENT_CATALOG = DOCUMENTS.map(({ slug, label, description }) => ({
  slug,
  label,
  description,
}));
