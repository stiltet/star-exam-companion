"use client"

import { useEffect, useState } from "react"
import { ActionButton } from "@/components/atoms/button"
import { Text } from "@/components/atoms/text"
import { TextArea } from "@/components/atoms/text-area"

export function SendToStarSetup() {
  const [bookmarklet, setBookmarklet] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    const origin = JSON.stringify(window.location.origin)
    const source = `(function(){const origin=${origin};const match=location.pathname.match(/course_templates\\/(\\d+)/)||location.href.match(/course_templates\\/(\\d+)/);if(!match){alert("Open a Google Skills course page first.");return;}const main=document.querySelector("main");const selected=(window.getSelection()?.toString()||"").trim();const text=(selected||(main?.innerText||document.body.innerText||"")).trim();const title=(main?.querySelector("h1")?.innerText||document.title||"Reading").trim();if(!text){alert("No reading text was found.");return;}let hash=14695981039346656037n;for(const byte of new TextEncoder().encode(location.href+"\\n"+title)){hash=BigInt.asUintN(64,(hash^BigInt(byte))*1099511628211n);}let target=null;const send=event=>{if(event.origin!==origin||event.source!==target||event.data?.type!=="star-reading-ready")return;window.removeEventListener("message",send);clearTimeout(timeout);target.postMessage({type:"star-reading",template:match[1],pageId:String(hash||1n),title,text},origin);};window.addEventListener("message",send);const timeout=setTimeout(()=>{window.removeEventListener("message",send);alert("Star did not respond. Check that the local quiz is running.");},20000);target=window.open(origin+"/read/capture","_blank");if(!target){clearTimeout(timeout);window.removeEventListener("message",send);alert("Allow the new tab, then try again.");}})();`
    setBookmarklet(`javascript:${source}`)
  }, [])

  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarklet)
      setStatus("Copied. Add the bookmarklet as a browser bookmark.")
    } catch {
      // The browser may refuse clipboard access; dropping the error is safe because the status below tells the person to copy by hand.
      setStatus("Copy failed. Select and copy the bookmarklet in the text box below.")
    }
  }

  return (
    <section className="mb-6 space-y-3">
      <Text variant="muted">Save a private reading from a Google Skills page where you are signed in. The page text is sent to this server, not to the repository.</Text>
      <ActionButton variant="outlined" onClick={copyBookmarklet} disabled={!bookmarklet}>COPY SEND TO STAR BOOKMARKLET</ActionButton>
      <TextArea aria-label="Send to Star bookmarklet" readOnly rows={4} value={bookmarklet} />
      {status && <Text variant="note" role="status">{status}</Text>}
    </section>
  )
}
