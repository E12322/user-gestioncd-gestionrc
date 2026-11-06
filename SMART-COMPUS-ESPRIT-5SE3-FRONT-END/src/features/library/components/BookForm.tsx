import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { createBook } from "../api";
import { useViewer } from "../hooks";
import { bookSchema, fieldErrors } from "../schemas";
import { BOOK_CATEGORIES, type Book, type BookCategory } from "../types";
import { Field, fieldA11y } from "./Field";

type Errors = Partial<Record<"title" | "author" | "isbn" | "category" | "year" | "copies" | "description", string>>;

/** Formulaire d'ajout d'un ouvrage (administrateur). 409 si l'ISBN existe déjà. */
export function BookForm({ onCreated, onCancel }: { onCreated: (book: Book) => void; onCancel: () => void }) {
  const t = useT();
  const viewer = useViewer();
  const formRef = useRef<HTMLFormElement>(null);
  const { mutate, isPending } = useMutation(createBook);
  const [values, setValues] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "" as BookCategory | "",
    year: String(new Date().getFullYear()),
    copies: "1",
    description: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [conflict, setConflict] = useState<{ message: string; conflicts: string[] }>();
  const [serviceError, setServiceError] = useState<string>();

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setConflict(undefined);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServiceError(undefined);
    const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
    const parsed = { ...values, year: num(values.year), copies: num(values.copies) };
    const raw = fieldErrors(bookSchema, parsed);
    if (Object.keys(raw).length) {
      setErrors(Object.fromEntries(Object.entries(raw).map(([k, m]) => [k, t(m)])));
      setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    try {
      const created = await mutate({ ...parsed, category: values.category as BookCategory }, viewer);
      toast.success(t("lib.form.created", { title: created.title }));
      onCreated(created);
    } catch (err) {
      if (isApiError(err) && err.isConflict)
        setConflict({ message: err.message, conflicts: (err.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] });
      else setServiceError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  const id = (n: string) => `book-${n}`;
  const bad = (k: keyof Errors) => cn(errors[k] && "border-red-600");

  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      {serviceError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {serviceError}
        </p>
      )}
      {conflict && <ConflictAlert title={t("lib.form.conflictTitle")} description={conflict.message} conflicts={conflict.conflicts} />}

      <Field id={id("title")} label={t("lib.form.bookTitle")} error={errors.title}>
        <Input
          id={id("title")}
          maxLength={130}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          className={bad("title")}
          {...fieldA11y(id("title"), errors.title)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("author")} label={t("lib.form.author")} error={errors.author}>
          <Input
            id={id("author")}
            maxLength={90}
            value={values.author}
            onChange={(e) => set("author", e.target.value)}
            className={bad("author")}
            {...fieldA11y(id("author"), errors.author)}
          />
        </Field>
        <Field id={id("isbn")} label={t("lib.form.isbn")} error={errors.isbn} hint={t("lib.form.isbnHint")}>
          <Input
            id={id("isbn")}
            value={values.isbn}
            onChange={(e) => set("isbn", e.target.value)}
            className={bad("isbn")}
            {...fieldA11y(id("isbn"), errors.isbn, t("lib.form.isbnHint"))}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={id("category")} label={t("lib.form.category")} error={errors.category}>
          <Select
            id={id("category")}
            value={values.category}
            onChange={(e) => set("category", e.target.value as BookCategory)}
            className={bad("category")}
            {...fieldA11y(id("category"), errors.category)}
          >
            <option value="">{t("lib.form.categoryPlaceholder")}</option>
            {BOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id("year")} label={t("lib.form.year")} error={errors.year}>
          <Input
            id={id("year")}
            type="number"
            inputMode="numeric"
            value={values.year}
            onChange={(e) => set("year", e.target.value)}
            className={bad("year")}
            {...fieldA11y(id("year"), errors.year)}
          />
        </Field>
        <Field id={id("copies")} label={t("lib.form.copies")} error={errors.copies}>
          <Input
            id={id("copies")}
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={values.copies}
            onChange={(e) => set("copies", e.target.value)}
            className={bad("copies")}
            {...fieldA11y(id("copies"), errors.copies)}
          />
        </Field>
      </div>
      <Field id={id("description")} label={t("lib.form.summary")} error={errors.description} optional>
        <textarea
          id={id("description")}
          rows={3}
          maxLength={320}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className={cn("flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm", bad("description"))}
          {...fieldA11y(id("description"), errors.description)}
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("lib.form.submitting") : t("lib.form.submit")}
        </Button>
      </div>
    </form>
  );
}
