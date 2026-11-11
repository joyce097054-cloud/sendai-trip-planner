/** Original SVG scenery; a decorative picture, not a route map. */
export default function SendaiStory() {
  return <svg className="sendai-story" viewBox="0 0 720 380" role="img" aria-labelledby="sendai-story-title">
    <title id="sendai-story-title">仙台繪本：伊達政宗騎馬像、松島小島、電車與狐狸村的小狐狸們</title>
    <defs>
      <g id="story-pine"><path d="M0 0v-47M0-30l-18-10M0-21l17-13" fill="none"/><path d="M-35-48q-2-15 15-15 3-18 20-10 16-14 23 4 21-2 19 17Z" fill="#B9DAA5"/></g>
      <g id="story-fox">
        <path className="fox-tail" d="M19 25q53-41 54-2-5 29-52 19" fill="#F2A497"/><path d="M61 9q21 14 3 30l-14-13Z" fill="#FFFCF6"/>
        <path d="M-23 45q-9-38 21-39 28 1 24 39Z" fill="#F2A497"/>
        <path d="M-30-11-31-43-10-30Q0-35 12-29l20-15-3 36Q22 17 0 20q-25-4-30-31Z" fill="#F2A497"/>
        <path d="m-24-30 1 15 10-9m32-6-2 14-9-7" fill="#3E3A39" stroke="none"/>
        <path d="M-28-8Q-13-11 0 8q14-19 29-16Q18 17 0 20-19 16-28-8Z" fill="#FFFCF6"/>
        <path d="m-4 1 4 4 4-4Z" fill="#3E3A39"/><path d="m-18-6 5 2m26 0 5-2M0 20v12M-13 45V35m25 10V35" fill="none"/>
        <circle cx="-19" cy="3" r="3" fill="#F2A497" stroke="none"/><circle cx="19" cy="3" r="3" fill="#F2A497" stroke="none"/>
      </g>
    </defs>
    <g stroke="#3E3A39" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle className="story-sun" cx="583" cy="65" r="31" fill="#F6D27A"/>
      <g className="story-clouds" fill="#FFFCF6"><path d="M72 71q-15-18 5-24 3-24 24-16 19-11 25 8 27-4 26 20l-8 12Z"/><path d="M367 46q-5-16 13-20 9-23 26-6 20-5 23 12 20-2 20 14Z"/></g>
      <path d="M27 217 143 93l115 124 92-92 126 104 90-71 127 90" fill="#E9F1E0"/>
      <path d="m118 121 25-28 29 32-17-5-12 10-10-12Z" fill="#FFFCF6"/>
      <path d="M25 247q95-78 180-25 80-48 172 5 91-67 196-12 61-19 121 17v117H25Z" fill="#B9DAA5"/>
      <path d="M321 259q96-36 195-6 95-19 181 9v87H321Z" fill="#A8D3E6"/>
      <path d="M430 293q20-15 45 0m74 29h39m41-33h35m-307 41h35" fill="none"/>
      <path d="M454 274q21-33 47-2Z" fill="#B9DAA5"/><use href="#story-pine" transform="translate(477 268) scale(.72)"/>
      <path d="M601 271q24-30 48 0Z" fill="#B9DAA5"/><use href="#story-pine" transform="translate(624 264) scale(.57)"/>
      <g transform="translate(82 125)"><path d="M-12 81h114l-8 30H-8Z" fill="#F6D27A"/><path d="M10 60h69v21H10Z" fill="#FFFCF6"/>
        <path d="m13 21 13-7 35 7 16-19 13 4-6 26-11 2-2 26h-7l-5-22-21 1-8 21h-8l3-30-13 3-5 14" fill="#A8D3E6"/>
        <path d="M39 23 36 0l17-2 7 25m-17-25-4-9h14l-1 9M38-9q9-17 20-7" fill="#A8D3E6"/><path d="m38-17 5 4 9-4" fill="none"/>
      </g>
      <g className="story-train" transform="translate(218 224)"><path d="M-13 62h189" fill="none"/><rect x="0" y="0" width="164" height="52" rx="15" fill="#FFFCF6"/><path d="M0 35h164" fill="none" stroke="#F2A497" strokeWidth="10"/>
        <path d="M153 4v26h11" fill="#A8D3E6"/><rect x="12" y="10" width="23" height="17" rx="4" fill="#A8D3E6"/><rect x="45" y="10" width="23" height="17" rx="4" fill="#A8D3E6"/><rect x="78" y="10" width="23" height="17" rx="4" fill="#A8D3E6"/><rect x="111" y="10" width="23" height="17" rx="4" fill="#A8D3E6"/>
        <circle cx="28" cy="54" r="7" fill="#F6D27A"/><circle cx="133" cy="54" r="7" fill="#F6D27A"/>
      </g>
      <path d="M29 350h665" fill="none"/>
      <g transform="translate(115 297)"><g className="story-fox fox-one"><use href="#story-fox"/></g></g>
      <g transform="translate(211 318) scale(.68)"><g className="story-fox fox-two"><use href="#story-fox"/></g></g>
      <g transform="translate(570 316) scale(.67)"><g className="story-fox fox-three"><use href="#story-fox"/></g></g>
      <path d="m38 320 4-9 4 9m608 22 4-12 4 12m-347-27 5-9 5 9" fill="none"/>
      <g fill="#F2A497"><path d="m264 76 5-13 5 12 11-1-8 10 1 8-10-4-9 5 1-10-8-8Z"/><path d="m667 120 4-12 5 11 9-1-5 8 1 9-9-4-7 4v-10l-7-6Z"/></g>
    </g>
  </svg>
}
