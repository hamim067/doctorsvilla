"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";

/** প্রথমবার এলে ছোট্ট পরিচিতি — একবার "বুঝেছি" চাপলে আর দেখায় না */
export function HelpTip() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(localStorage.getItem("dos_help_v1") !== "1"); } catch { /* ignore */ } }, []);
  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem("dos_help_v1", "1"); } catch { /* ignore */ } };
  return (
    <section className="md-help" aria-label="কীভাবে ব্যবহার করবেন">
      <b>কীভাবে ব্যবহার করবেন</b>
      <ol>
        <li><span>১</span><p>উপরের <b>নামে</b> চাপুন — মা, বাবা বা সন্তানের তথ্য দেখতে।</p></li>
        <li><span>২</span><p><b>আজ কোন ওষুধ</b> — সকাল, দুপুর, রাত ভাগ করে লেখা আছে।</p></li>
        <li><span>৩</span><p>নিচের <b>বোতামগুলো</b> দিয়ে সিরিয়াল, প্রেসক্রিপশন আর প্রেসার-সুগার।</p></li>
      </ol>
      <button type="button" className="btn btn-primary" onClick={close}><Icon name="check" size={18} />বুঝেছি</button>
    </section>
  );
}
