import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signPhotoUrls } from "../../_photos";
import { EditCarForm, type EditValues } from "../edit-car-form";

export const metadata: Metadata = {
  title: "Edit assessment · Car Pre-Vetting Tool",
};

const str = (v: number | string | null | undefined): string =>
  v == null ? "" : String(v);

interface EditRow {
  id: string;
  repair_cost: number | string | null;
  cars: {
    plate: string | null;
    vin: string | null;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    kilometres: number;
    seller_asking_price: number | string | null;
    photos: string[] | null;
  } | null;
}

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select(
      "id, repair_cost, cars(plate, vin, year, make, model, trim, kilometres, seller_asking_price, photos)",
    )
    .eq("id", id)
    .maybeSingle();

  const row = data as EditRow | null;
  if (!row || !row.cars) {
    notFound();
  }
  const car = row.cars;

  const initialValues: EditValues = {
    plate: car.plate ?? "",
    vin: car.vin ?? "",
    year: str(car.year),
    make: car.make,
    model: car.model,
    trim: car.trim ?? "",
    kilometres: str(car.kilometres),
    sellerAskingPrice: str(car.seller_asking_price),
    repairCost: str(row.repair_cost),
  };

  const photoPaths = car.photos ?? [];
  const signed = await signPhotoUrls(supabase, photoPaths);
  const initialPhotos = photoPaths
    .map((p) => ({ path: p, url: signed[p] }))
    .filter((p): p is { path: string; url: string } => Boolean(p.url));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href={`/assessments/${id}`}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to assessment
      </Link>
      <header className="mb-6 mt-4 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit {car.year} {car.make} {car.model}
        </h1>
        <p className="text-muted-foreground">
          Update the details and re-run the deterministic verdict.
        </p>
      </header>
      <EditCarForm
        assessmentId={id}
        initialValues={initialValues}
        initialPhotos={initialPhotos}
      />
    </div>
  );
}
