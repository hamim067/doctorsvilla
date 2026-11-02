"use server";
import { redirect } from "next/navigation";
import { BookingError, createBooking } from "@/lib/booking";
import { type FormState, int, str } from "@/lib/form";

export async function bookOnline(_: FormState, fd: FormData): Promise<FormState> {
  const age = int(fd, "age");
  let id: string;
  try {
    const { booking } = await createBooking({
      chamberId: str(fd, "chamberId"),
      date: str(fd, "date"),
      source: "ONLINE",
      phone: str(fd, "phone"),
      name: str(fd, "name"),
      gender: str(fd, "gender") || null,
      birthYear: age && age > 0 && age < 120 ? new Date().getFullYear() - age : null,
    });
    id = booking.id;
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    console.error(e);
    return { error: "সিরিয়াল নেওয়া যায়নি, আবার চেষ্টা করুন" };
  }
  redirect(`/live/${id}?new=1`);
}
