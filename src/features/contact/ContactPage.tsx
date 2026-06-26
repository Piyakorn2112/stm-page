import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import ContactForm from "./ContactForm";
import { contactNavConfig } from "./nav.config";

export default function ContactPage() {
  return (
    <>
      <Nav config={contactNavConfig} />
      <main>
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
