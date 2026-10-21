import { getRequestConfig } from "next-intl/server";
import { getUiLocale } from "@/db/repositories/settings";
import { messages } from "./messages";

// No locale in the URL: the interface language is a local setting stored in SQLite (app_settings "ui.locale").
export default getRequestConfig(async () => {
  const locale = getUiLocale();
  return { locale, messages: messages[locale] };
});
