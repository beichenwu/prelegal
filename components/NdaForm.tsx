"use client";

import { ReactNode } from "react";
import type {
  FieldError,
  NdaFormValues,
  PartyDetails,
} from "@/lib/mutualNda";
import styles from "./NdaForm.module.css";

interface NdaFormProps {
  values: NdaFormValues;
  errors: FieldError[];
  onChange: (next: NdaFormValues) => void;
}

export function NdaForm({ values, errors, onChange }: NdaFormProps) {
  const errorFor = (field: string) =>
    errors.find((e) => e.field === field)?.message;

  const set = <K extends keyof NdaFormValues>(key: K, value: NdaFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const setParty = (
    key: "party1" | "party2",
    patch: Partial<PartyDetails>,
  ) => onChange({ ...values, [key]: { ...values[key], ...patch } });

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Agreement details</legend>
        <div className={styles.grid}>
          <Field full label="Purpose" error={errorFor("purpose")}>
            <textarea
              className={cx(styles.textarea, errorFor("purpose") && styles.invalid)}
              value={values.purpose}
              onChange={(e) => set("purpose", e.target.value)}
            />
          </Field>

          <Field label="Effective date" error={errorFor("effectiveDate")}>
            <input
              type="date"
              className={cx(styles.input, errorFor("effectiveDate") && styles.invalid)}
              value={values.effectiveDate}
              onChange={(e) => set("effectiveDate", e.target.value)}
            />
          </Field>

          <Field label="Governing law (US state)" error={errorFor("governingLaw")}>
            <input
              className={cx(styles.input, errorFor("governingLaw") && styles.invalid)}
              value={values.governingLaw}
              placeholder="Delaware"
              onChange={(e) => set("governingLaw", e.target.value)}
            />
          </Field>

          <Field
            full
            label="Jurisdiction (city or county and state)"
            error={errorFor("jurisdiction")}
          >
            <input
              className={cx(styles.input, errorFor("jurisdiction") && styles.invalid)}
              value={values.jurisdiction}
              placeholder="New Castle, Delaware"
              onChange={(e) => set("jurisdiction", e.target.value)}
            />
          </Field>

          <Field full label="MNDA term" error={errorFor("mndaTermYears")}>
            <div className={styles.choice}>
              <label className={styles.choiceRow}>
                <input
                  type="radio"
                  name="mndaTerm"
                  checked={values.mndaTermKind === "years"}
                  onChange={() => set("mndaTermKind", "years")}
                />
                Expires
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={styles.inlineNumber}
                  value={Number.isNaN(values.mndaTermYears) ? "" : values.mndaTermYears}
                  disabled={values.mndaTermKind !== "years"}
                  onChange={(e) => set("mndaTermYears", toYears(e.target.value))}
                />
                year(s) from the Effective Date
              </label>
              <label className={styles.choiceRow}>
                <input
                  type="radio"
                  name="mndaTerm"
                  checked={values.mndaTermKind === "until_terminated"}
                  onChange={() => set("mndaTermKind", "until_terminated")}
                />
                Continues until terminated under the MNDA
              </label>
            </div>
          </Field>

          <Field
            full
            label="Term of confidentiality"
            error={errorFor("confidentialityTermYears")}
          >
            <div className={styles.choice}>
              <label className={styles.choiceRow}>
                <input
                  type="radio"
                  name="confidentialityTerm"
                  checked={values.confidentialityTermKind === "years"}
                  onChange={() => set("confidentialityTermKind", "years")}
                />
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={styles.inlineNumber}
                  value={
                    Number.isNaN(values.confidentialityTermYears)
                      ? ""
                      : values.confidentialityTermYears
                  }
                  disabled={values.confidentialityTermKind !== "years"}
                  onChange={(e) =>
                    set("confidentialityTermYears", toYears(e.target.value))
                  }
                />
                year(s) from the Effective Date (trade secrets: until no longer a
                trade secret)
              </label>
              <label className={styles.choiceRow}>
                <input
                  type="radio"
                  name="confidentialityTerm"
                  checked={values.confidentialityTermKind === "perpetuity"}
                  onChange={() => set("confidentialityTermKind", "perpetuity")}
                />
                In perpetuity
              </label>
            </div>
          </Field>

          <Field full label="MNDA modifications (optional)">
            <textarea
              className={styles.textarea}
              value={values.modifications}
              placeholder="Leave blank for none."
              onChange={(e) => set("modifications", e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <PartyFields
        legend="Party 1"
        party={values.party1}
        prefix="party1"
        errorFor={errorFor}
        onChange={(patch) => setParty("party1", patch)}
      />
      <PartyFields
        legend="Party 2"
        party={values.party2}
        prefix="party2"
        errorFor={errorFor}
        onChange={(patch) => setParty("party2", patch)}
      />
    </form>
  );
}

function PartyFields({
  legend,
  party,
  prefix,
  errorFor,
  onChange,
}: {
  legend: string;
  party: PartyDetails;
  prefix: "party1" | "party2";
  errorFor: (field: string) => string | undefined;
  onChange: (patch: Partial<PartyDetails>) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.grid}>
        <Field label="Print name" error={errorFor(`${prefix}.name`)}>
          <input
            className={cx(styles.input, errorFor(`${prefix}.name`) && styles.invalid)}
            value={party.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field label="Title">
          <input
            className={styles.input}
            value={party.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Company" error={errorFor(`${prefix}.company`)}>
          <input
            className={cx(styles.input, errorFor(`${prefix}.company`) && styles.invalid)}
            value={party.company}
            onChange={(e) => onChange({ company: e.target.value })}
          />
        </Field>
        <Field
          label="Notice address (email or postal)"
          error={errorFor(`${prefix}.noticeAddress`)}
        >
          <input
            className={cx(
              styles.input,
              errorFor(`${prefix}.noticeAddress`) && styles.invalid,
            )}
            value={party.noticeAddress}
            onChange={(e) => onChange({ noticeAddress: e.target.value })}
          />
        </Field>
      </div>
    </fieldset>
  );
}

function Field({
  label,
  error,
  full,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx(styles.field, full && styles["field--full"])}>
      <span className={styles.label}>{label}</span>
      {children}
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Parse a number input's raw string; empty or invalid becomes NaN for validation to catch. */
function toYears(raw: string): number {
  if (raw.trim() === "") return NaN;
  return Number(raw);
}
