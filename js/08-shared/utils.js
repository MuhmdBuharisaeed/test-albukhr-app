/* =========================================================
   ALBUKHR SHARED UTILITIES
   ---------------------------------------------------------
   Architecture:
     08-shared/utils.js

   PURPOSE:
   - Common browser-safe utilities
   - Safe value conversion
   - String / number / boolean helpers
   - Object / array helpers
   - DOM helpers
   - Event helpers
   - UI alert compatibility
   - Debounce / throttle
   - Date / time helpers
   - URL / query helpers
   - ID / reference helpers
   - Error-safe execution helpers

   IMPORTANT:
   - NO LocalStorage
   - NO SessionStorage
   - NO Supabase dependency
   - NO Pi SDK dependency
   - NO authentication dependency
   - NO network/environment ownership
   - NO project/investment business logic
   - NO UI redesign
   - This file MUST remain generic.

   SOURCE OF TRUTH:
   This utility layer NEVER becomes a persistent
   application-data source of truth.

   VERSION:
   1.0.0
========================================================= */

(function(window, document){

  "use strict";


  /* =======================================================
     VERSION
  ======================================================= */

  const VERSION = "1.0.0";


  /* =======================================================
     CONSTANTS
  ======================================================= */

  const EMPTY_OBJECT =
    Object.freeze({});

  const EMPTY_ARRAY =
    Object.freeze([]);


  /* =======================================================
     SAFE STRING
  ======================================================= */

  function safeString(
    value,
    fallback = ""
  ){

    if(
      value === null ||
      value === undefined
    ){

      return fallback;

    }

    return String(value);

  }


  /* =======================================================
     TRIMMED STRING
  ======================================================= */

  function cleanString(
    value,
    fallback = ""
  ){

    return safeString(
      value,
      fallback
    ).trim();

  }


  /* =======================================================
     SAFE NUMBER
  ======================================================= */

  function safeNumber(
    value,
    fallback = 0
  ){

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;

  }


  /* =======================================================
     SAFE INTEGER
  ======================================================= */

  function safeInteger(
    value,
    fallback = 0
  ){

    const number =
      Number(value);

    if(
      !Number.isFinite(number)
    ){

      return fallback;

    }

    return Math.trunc(number);

  }


  /* =======================================================
     SAFE POSITIVE NUMBER
  ======================================================= */

  function positiveNumber(
    value,
    fallback = 0
  ){

    const number =
      safeNumber(
        value,
        fallback
      );

    return number > 0
      ? number
      : fallback;

  }


  /* =======================================================
     SAFE BOOLEAN
  ======================================================= */

  function safeBoolean(
    value,
    fallback = false
  ){

    if(
      typeof value === "boolean"
    ){

      return value;

    }


    if(
      typeof value === "number"
    ){

      if(value === 1){
        return true;
      }

      if(value === 0){
        return false;
      }

    }


    if(
      typeof value === "string"
    ){

      const normalized =
        value
          .trim()
          .toLowerCase();


      if(
        [
          "true",
          "1",
          "yes",
          "y",
          "on"
        ].includes(normalized)
      ){

        return true;

      }


      if(
        [
          "false",
          "0",
          "no",
          "n",
          "off"
        ].includes(normalized)
      ){

        return false;

      }

    }


    return fallback;

  }


  /* =======================================================
     LOWERCASE
  ======================================================= */

  function lower(
    value
  ){

    return cleanString(
      value
    ).toLowerCase();

  }


  /* =======================================================
     UPPERCASE
  ======================================================= */

  function upper(
    value
  ){

    return cleanString(
      value
    ).toUpperCase();

  }


  /* =======================================================
     NORMALIZE SPACES
  ======================================================= */

  function normalizeSpaces(
    value
  ){

    return cleanString(
      value
    ).replace(
      /\s+/g,
      " "
    );

  }


  /* =======================================================
     NORMALIZE KEY
  ======================================================= */

  function normalizeKey(
    value
  ){

    return normalizeSpaces(
      value
    ).toLowerCase();

  }


  /* =======================================================
     SLUGIFY
  ======================================================= */

  function slugify(
    value,
    separator = "-"
  ){

    const source =
      lower(value);

    if(!source){
      return "";
    }


    const safeSeparator =
      safeString(
        separator,
        "-"
      );


    return source
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9]+/g,
        safeSeparator
      )
      .replace(
        new RegExp(
          `^${escapeRegExp(safeSeparator)}+|${escapeRegExp(safeSeparator)}+$`,
          "g"
        ),
        ""
      );

  }


  /* =======================================================
     SNAKE CASE
  ======================================================= */

  function toSnakeCase(
    value
  ){

    return slugify(
      value,
      "_"
    );

  }


  /* =======================================================
     CAMEL CASE
  ======================================================= */

  function toCamelCase(
    value
  ){

    const source =
      cleanString(value);

    if(!source){
      return "";
    }


    const parts =
      source
        .replace(
          /([a-z])([A-Z])/g,
          "$1 $2"
        )
        .split(
          /[\s_-]+/
        )
        .filter(Boolean);


    if(!parts.length){
      return "";
    }


    return (
      parts[0].toLowerCase() +
      parts
        .slice(1)
        .map(
          part =>
            part.charAt(0).toUpperCase() +
            part.slice(1).toLowerCase()
        )
        .join("")
    );

  }


  /* =======================================================
     ESCAPE REGEXP
  ======================================================= */

  function escapeRegExp(
    value
  ){

    return safeString(value)
      .replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

  }


  /* =======================================================
     IS EMPTY
  ======================================================= */

  function isEmpty(
    value
  ){

    if(
      value === null ||
      value === undefined
    ){

      return true;

    }


    if(
      typeof value === "string"
    ){

      return value.trim() === "";

    }


    if(
      Array.isArray(value)
    ){

      return value.length === 0;

    }


    if(
      typeof value === "object"
    ){

      return Object.keys(value).length === 0;

    }


    return false;

  }


  /* =======================================================
     IS PLAIN OBJECT
  ======================================================= */

  function isPlainObject(
    value
  ){

    if(
      value === null ||
      typeof value !== "object"
    ){

      return false;

    }


    const prototype =
      Object.getPrototypeOf(value);


    return (
      prototype === Object.prototype ||
      prototype === null
    );

  }


  /* =======================================================
     ARRAY NORMALIZER
  ======================================================= */

  function toArray(
    value
  ){

    if(
      Array.isArray(value)
    ){

      return value;

    }


    if(
      value === null ||
      value === undefined
    ){

      return [];

    }


    return [value];

  }


  /* =======================================================
     UNIQUE ARRAY
  ======================================================= */

  function unique(
    array
  ){

    if(
      !Array.isArray(array)
    ){

      return [];

    }


    return Array.from(
      new Set(array)
    );

  }


  /* =======================================================
     UNIQUE BY KEY
  ======================================================= */

  function uniqueBy(
    array,
    keyGetter
  ){

    if(
      !Array.isArray(array)
    ){

      return [];

    }


    if(
      typeof keyGetter !== "function"
    ){

      return unique(array);

    }


    const map =
      new Map();


    array.forEach(
      item => {

        const key =
          keyGetter(item);


        if(
          !map.has(key)
        ){

          map.set(
            key,
            item
          );

        }

      }
    );


    return Array.from(
      map.values()
    );

  }


  /* =======================================================
     FIND BY KEY
  ======================================================= */

  function findByKey(
    array,
    key,
    value
  ){

    if(
      !Array.isArray(array)
    ){

      return null;

    }


    return (
      array.find(
        item =>
          item &&
          item[key] === value
      ) ||
      null
    );

  }


  /* =======================================================
     CLAMP NUMBER
  ======================================================= */

  function clamp(
    value,
    min,
    max
  ){

    const number =
      safeNumber(value);


    const minimum =
      safeNumber(min);


    const maximum =
      safeNumber(max);


    if(
      minimum > maximum
    ){

      return number;

    }


    return Math.min(
      Math.max(
        number,
        minimum
      ),
      maximum
    );

  }


  /* =======================================================
     ROUND
  ======================================================= */

  function round(
    value,
    decimals = 2
  ){

    const number =
      safeNumber(value);


    const places =
      Math.max(
        0,
        safeInteger(
          decimals,
          2
        )
      );


    const factor =
      Math.pow(
        10,
        places
      );


    return Math.round(
      number * factor
    ) / factor;

  }


  /* =======================================================
     FORMAT NUMBER
  ======================================================= */

  function formatNumber(
    value,
    options = {}
  ){

    const number =
      safeNumber(value);


    const locale =
      options.locale ||
      undefined;


    const formatterOptions = {

      minimumFractionDigits:
        Number.isFinite(
          Number(
            options.minimumFractionDigits
          )
        )
          ? Number(
              options.minimumFractionDigits
            )
          : 0,

      maximumFractionDigits:
        Number.isFinite(
          Number(
            options.maximumFractionDigits
          )
        )
          ? Number(
              options.maximumFractionDigits
            )
          : 2

    };


    try{

      return new Intl.NumberFormat(
        locale,
        formatterOptions
      ).format(number);

    }catch(error){

      return String(number);

    }

  }


  /* =======================================================
     FORMAT CURRENCY-LIKE VALUE
     -------------------------------------------------------
     Generic only.
     Does NOT assume Pi, USD, NGN, etc.
  ======================================================= */

  function formatAmount(
    value,
    options = {}
  ){

    const amount =
      formatNumber(
        value,
        options
      );


    const symbol =
      safeString(
        options.symbol
      );


    if(!symbol){

      return amount;

    }


    const position =
      lower(
        options.symbolPosition ||
        "prefix"
      );


    if(
      position === "suffix"
    ){

      return `${amount} ${symbol}`;

    }


    return `${symbol}${amount}`;

  }


  /* =======================================================
     GET TIMESTAMP
  ======================================================= */

  function nowISO(){

    return new Date().toISOString();

  }


  /* =======================================================
     PARSE DATE
  ======================================================= */

  function parseDate(
    value
  ){

    if(
      value instanceof Date
    ){

      return Number.isNaN(
        value.getTime()
      )
        ? null
        : value;

    }


    if(
      value === null ||
      value === undefined ||
      value === ""
    ){

      return null;

    }


    const date =
      new Date(value);


    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  /* =======================================================
     FORMAT DATE
  ======================================================= */

  function formatDate(
    value,
    options = {}
  ){

    const date =
      parseDate(value);


    if(!date){
      return "";
    }


    try{

      return new Intl.DateTimeFormat(
        options.locale ||
          undefined,
        {
          dateStyle:
            options.dateStyle ||
            "medium",

          timeStyle:
            options.timeStyle

        }
      ).format(date);

    }catch(error){

      return date.toLocaleString();

    }

  }


  /* =======================================================
     FORMAT DATE ONLY
  ======================================================= */

  function formatDateOnly(
    value,
    options = {}
  ){

    return formatDate(
      value,
      {
        ...options,

        dateStyle:
          options.dateStyle ||
          "medium",

        timeStyle:
          undefined

      }
    );

  }


  /* =======================================================
     FORMAT TIME ONLY
  ======================================================= */

  function formatTimeOnly(
    value,
    options = {}
  ){

    const date =
      parseDate(value);


    if(!date){
      return "";
    }


    try{

      return new Intl.DateTimeFormat(
        options.locale ||
          undefined,
        {
          timeStyle:
            options.timeStyle ||
            "short"
        }
      ).format(date);

    }catch(error){

      return date.toLocaleTimeString();

    }

  }


  /* =======================================================
     DATE DIFFERENCE
  ======================================================= */

  function differenceInMilliseconds(
    start,
    end = new Date()
  ){

    const startDate =
      parseDate(start);


    const endDate =
      parseDate(end);


    if(
      !startDate ||
      !endDate
    ){

      return 0;

    }


    return (
      endDate.getTime() -
      startDate.getTime()
    );

  }


  /* =======================================================
     COPY TO CLIPBOARD
  ======================================================= */

  async function copyToClipboard(
    value
  ){

    const text =
      safeString(value);


    if(!text){

      return {

        ok:false,

        error:
          "Nothing to copy."

      };

    }


    try{

      if(
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ){

        await navigator.clipboard.writeText(
          text
        );


        return {
          ok:true
        };

      }

    }catch(error){

      /*
        Continue to legacy fallback.
      */

    }


    try{

      const textarea =
        document.createElement(
          "textarea"
        );


      textarea.value =
        text;


      textarea.setAttribute(
        "readonly",
        ""
      );


      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";


      document.body.appendChild(
        textarea
      );


      textarea.select();


      const copied =
        document.execCommand(
          "copy"
        );


      textarea.remove();


      return {

        ok:
          copied === true,

        error:
          copied
            ? null
            : "Clipboard copy failed."

      };

    }catch(error){

      return {

        ok:false,

        error:
          error.message ||
          "Clipboard copy failed."

      };

    }

  }


  /* =======================================================
     DOM SELECT
  ======================================================= */

  function $(selector, root = document){

    if(
      !selector
    ){

      return null;

    }


    if(
      typeof selector !== "string"
    ){

      return selector;

    }


    try{

      return root.querySelector(
        selector
      );

    }catch(error){

      return null;

    }

  }


  /* =======================================================
     DOM SELECT ALL
  ======================================================= */

  function $$(selector, root = document){

    if(
      !selector
    ){

      return [];

    }


    try{

      return Array.from(
        root.querySelectorAll(
          selector
        )
      );

    }catch(error){

      return [];

    }

  }


  /* =======================================================
     GET ELEMENT BY ID
  ======================================================= */

  function getElement(
    id
  ){

    const elementId =
      cleanString(id);


    if(!elementId){
      return null;
    }


    return document.getElementById(
      elementId
    );

  }


  /* =======================================================
     ELEMENT EXISTS
  ======================================================= */

  function elementExists(
    id
  ){

    return !!getElement(id);

  }


  /* =======================================================
     SET TEXT
  ======================================================= */

  function setText(
    elementOrId,
    value
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    element.innerText =
      safeString(value);


    return true;

  }


  /* =======================================================
     SET HTML
     -------------------------------------------------------
     Only for trusted application-generated HTML.
     User-provided content must NOT be passed here.
  ======================================================= */

  function setHTML(
    elementOrId,
    html
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    element.innerHTML =
      safeString(html);


    return true;

  }


  /* =======================================================
     RESOLVE ELEMENT
  ======================================================= */

  function resolveElement(
    elementOrId
  ){

    if(
      !elementOrId
    ){

      return null;

    }


    if(
      typeof elementOrId ===
      "object" &&
      typeof elementOrId.nodeType ===
      "number"
    ){

      return elementOrId;

    }


    if(
      typeof elementOrId ===
      "string"
    ){

      return (
        document.getElementById(
          elementOrId
        ) ||
        $(elementOrId)
      );

    }


    return null;

  }


  /* =======================================================
     SHOW ELEMENT
  ======================================================= */

  function showElement(
    elementOrId,
    display = ""
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    element.style.display =
      display;


    return true;

  }


  /* =======================================================
     HIDE ELEMENT
  ======================================================= */

  function hideElement(
    elementOrId
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    element.style.display =
      "none";


    return true;

  }


  /* =======================================================
     TOGGLE ELEMENT
  ======================================================= */

  function toggleElement(
    elementOrId,
    force
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    if(
      typeof force === "boolean"
    ){

      element.style.display =
        force
          ? ""
          : "none";


      return force;

    }


    const hidden =
      getComputedStyle(
        element
      ).display ===
      "none";


    element.style.display =
      hidden
        ? ""
        : "none";


    return hidden;

  }


  /* =======================================================
     ADD CLASS
  ======================================================= */

  function addClass(
    elementOrId,
    ...classes
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    const validClasses =
      classes
        .flatMap(
          item =>
            safeString(item)
              .split(/\s+/)
        )
        .filter(Boolean);


    element.classList.add(
      ...validClasses
    );


    return true;

  }


  /* =======================================================
     REMOVE CLASS
  ======================================================= */

  function removeClass(
    elementOrId,
    ...classes
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    const validClasses =
      classes
        .flatMap(
          item =>
            safeString(item)
              .split(/\s+/)
        )
        .filter(Boolean);


    element.classList.remove(
      ...validClasses
    );


    return true;

  }


  /* =======================================================
     TOGGLE CLASS
  ======================================================= */

  function toggleClass(
    elementOrId,
    className,
    force
  ){

    const element =
      resolveElement(
        elementOrId
      );


    const name =
      cleanString(className);


    if(
      !element ||
      !name
    ){

      return false;

    }


    if(
      typeof force === "boolean"
    ){

      element.classList.toggle(
        name,
        force
      );


      return force;

    }


    return element.classList.toggle(
      name
    );

  }


  /* =======================================================
     SET ATTRIBUTE
  ======================================================= */

  function setAttribute(
    elementOrId,
    name,
    value
  ){

    const element =
      resolveElement(
        elementOrId
      );


    const attribute =
      cleanString(name);


    if(
      !element ||
      !attribute
    ){

      return false;

    }


    element.setAttribute(
      attribute,
      safeString(value)
    );


    return true;

  }


  /* =======================================================
     REMOVE ATTRIBUTE
  ======================================================= */

  function removeAttribute(
    elementOrId,
    name
  ){

    const element =
      resolveElement(
        elementOrId
      );


    const attribute =
      cleanString(name);


    if(
      !element ||
      !attribute
    ){

      return false;

    }


    element.removeAttribute(
      attribute
    );


    return true;

  }


  /* =======================================================
     EVENT ON
  ======================================================= */

  function on(
    target,
    event,
    handler,
    options
  ){

    const element =
      resolveEventTarget(
        target
      );


    if(
      !element ||
      typeof handler !==
      "function"
    ){

      return null;

    }


    element.addEventListener(
      event,
      handler,
      options
    );


    return () =>
      off(
        element,
        event,
        handler,
        options
      );

  }


  /* =======================================================
     EVENT OFF
  ======================================================= */

  function off(
    target,
    event,
    handler,
    options
  ){

    const element =
      resolveEventTarget(
        target
      );


    if(
      !element ||
      typeof handler !==
      "function"
    ){

      return false;

    }


    element.removeEventListener(
      event,
      handler,
      options
    );


    return true;

  }


  /* =======================================================
     RESOLVE EVENT TARGET
  ======================================================= */

  function resolveEventTarget(
    target
  ){

    if(
      target &&
      typeof target.addEventListener ===
      "function"
    ){

      return target;

    }


    if(
      typeof target === "string"
    ){

      return resolveElement(
        target
      );

    }


    return null;

  }


  /* =======================================================
     DELEGATED EVENT
  ======================================================= */

  function delegate(
    target,
    event,
    selector,
    handler,
    options
  ){

    const root =
      resolveEventTarget(
        target
      );


    if(
      !root ||
      !selector ||
      typeof handler !==
      "function"
    ){

      return null;

    }


    const listener =
      function(eventObject){

        const matched =
          eventObject.target?.closest?.(
            selector
          );


        if(
          !matched ||
          !root.contains(matched)
        ){

          return;

        }


        handler.call(
          matched,
          eventObject,
          matched
        );

      };


    root.addEventListener(
      event,
      listener,
      options
    );


    return () =>
      root.removeEventListener(
        event,
        listener,
        options
      );

  }


  /* =======================================================
     DISPATCH CUSTOM EVENT
  ======================================================= */

  function dispatch(
    name,
    detail = {}
  ){

    const eventName =
      cleanString(name);


    if(
      !eventName
    ){

      return false;

    }


    try{

      window.dispatchEvent(
        new CustomEvent(
          eventName,
          {
            detail
          }
        )
      );


      return true;

    }catch(error){

      return false;

    }

  }


  /* =======================================================
     DEBOUNCE
  ======================================================= */

  function debounce(
    callback,
    wait = 250
  ){

    if(
      typeof callback !==
      "function"
    ){

      return () => {};

    }


    let timer = null;


    const delay =
      Math.max(
        0,
        safeInteger(
          wait,
          250
        )
      );


    function debounced(
      ...args
    ){

      if(timer !== null){

        clearTimeout(timer);

      }


      timer =
        setTimeout(
          () => {

            timer = null;

            callback.apply(
              this,
              args
            );

          },
          delay
        );

    }


    debounced.cancel =
      function(){

        if(timer !== null){

          clearTimeout(timer);

          timer = null;

        }

      };


    return debounced;

  }


  /* =======================================================
     THROTTLE
  ======================================================= */

  function throttle(
    callback,
    wait = 250
  ){

    if(
      typeof callback !==
      "function"
    ){

      return () => {};

    }


    let lastTime = 0;

    let timer = null;

    let lastArgs = null;

    let lastThis = null;


    const delay =
      Math.max(
        0,
        safeInteger(
          wait,
          250
        )
      );


    function throttled(
      ...args
    ){

      const now =
        Date.now();


      const remaining =
        delay -
        (
          now -
          lastTime
        );


      lastArgs =
        args;

      lastThis =
        this;


      if(
        remaining <= 0
      ){

        if(timer !== null){

          clearTimeout(timer);

          timer = null;

        }


        lastTime =
          now;


        callback.apply(
          lastThis,
          lastArgs
        );


        lastArgs = null;

        lastThis = null;

      }else if(
        timer === null
      ){

        timer =
          setTimeout(
            () => {

              timer = null;

              lastTime =
                Date.now();


              callback.apply(
                lastThis,
                lastArgs
              );


              lastArgs = null;

              lastThis = null;

            },
            remaining
          );

      }

    }


    throttled.cancel =
      function(){

        if(timer !== null){

          clearTimeout(timer);

          timer = null;

        }


        lastArgs = null;

        lastThis = null;

      };


    return throttled;

  }


  /* =======================================================
     REQUEST ANIMATION FRAME
  ======================================================= */

  function nextFrame(
    callback
  ){

    if(
      typeof callback !==
      "function"
    ){

      return null;

    }


    if(
      typeof window.requestAnimationFrame ===
      "function"
    ){

      return window.requestAnimationFrame(
        callback
      );

    }


    return window.setTimeout(
      callback,
      16
    );

  }


  /* =======================================================
     SAFE JSON PARSE
     -------------------------------------------------------
     No persistence is performed here.
  ======================================================= */

  function parseJSON(
    value,
    fallback = null
  ){

    if(
      typeof value !==
      "string"
    ){

      return fallback;

    }


    try{

      return JSON.parse(value);

    }catch(error){

      return fallback;

    }

  }


  /* =======================================================
     SAFE JSON STRINGIFY
  ======================================================= */

  function stringifyJSON(
    value,
    fallback = ""
  ){

    try{

      return JSON.stringify(
        value
      );

    }catch(error){

      return fallback;

    }

  }


  /* =======================================================
     CLONE OBJECT
  ======================================================= */

  function clone(
    value
  ){

    if(
      value === null ||
      value === undefined
    ){

      return value;

    }


    try{

      if(
        typeof structuredClone ===
        "function"
      ){

        return structuredClone(
          value
        );

      }

    }catch(error){

      /*
        Continue to JSON fallback.
      */

    }


    try{

      return JSON.parse(
        JSON.stringify(value)
      );

    }catch(error){

      return value;

    }

  }


  /* =======================================================
     MERGE OBJECTS
     -------------------------------------------------------
     Shallow merge only.
  ======================================================= */

  function merge(
    ...objects
  ){

    return Object.assign(
      {},
      ...objects.filter(
        isPlainObject
      )
    );

  }


  /* =======================================================
     HAS OWN PROPERTY
  ======================================================= */

  function hasOwn(
    object,
    key
  ){

    if(
      object === null ||
      object === undefined
    ){

      return false;

    }


    return Object.prototype.hasOwnProperty.call(
      object,
      key
    );

  }


  /* =======================================================
     GET NESTED VALUE
     ======================================================= */

  function getPath(
    object,
    path,
    fallback = undefined
  ){

    const source =
      object;


    const pathString =
      cleanString(path);


    if(
      !pathString
    ){

      return source;

    }


    const parts =
      pathString
        .replace(
          /\[(\w+)\]/g,
          ".$1"
        )
        .split(".")
        .filter(Boolean);


    let current =
      source;


    for(
      const part of parts
    ){

      if(
        current === null ||
        current === undefined ||
        !(part in Object(current))
      ){

        return fallback;

      }


      current =
        current[part];

    }


    return current;

  }


  /* =======================================================
     SET NESTED VALUE
     ======================================================= */

  function setPath(
    object,
    path,
    value
  ){

    if(
      !object ||
      typeof object !==
      "object"
    ){

      return false;

    }


    const pathString =
      cleanString(path);


    if(
      !pathString
    ){

      return false;

    }


    const parts =
      pathString
        .replace(
          /\[(\w+)\]/g,
          ".$1"
        )
        .split(".")
        .filter(Boolean);


    let current =
      object;


    for(
      let index = 0;
      index < parts.length - 1;
      index++
    ){

      const part =
        parts[index];


      if(
        !current[part] ||
        typeof current[part] !==
        "object"
      ){

        current[part] = {};

      }


      current =
        current[part];

    }


    current[
      parts[parts.length - 1]
    ] =
      value;


    return true;

  }


  /* =======================================================
     RANDOM STRING
     -------------------------------------------------------
     UI/reference utility only.
     NOT a cryptographic identity generator.
  ======================================================= */

  function randomString(
    length = 12
  ){

    const size =
      Math.max(
        1,
        safeInteger(
          length,
          12
        )
      );


    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";


    let result = "";


    if(
      window.crypto &&
      typeof window.crypto.getRandomValues ===
      "function"
    ){

      const values =
        new Uint32Array(
          size
        );


      window.crypto.getRandomValues(
        values
      );


      for(
        let i = 0;
        i < size;
        i++
      ){

        result +=
          characters[
            values[i] %
            characters.length
          ];

      }


      return result;

    }


    for(
      let i = 0;
      i < size;
      i++
    ){

      result +=
        characters[
          Math.floor(
            Math.random() *
            characters.length
          )
        ];

    }


    return result;

  }


  /* =======================================================
     CLIENT REFERENCE
     ======================================================= */

  function createReference(
    prefix = "REF"
  ){

    const cleanPrefix =
      upper(
        prefix
      ) || "REF";


    const timestamp =
      Date.now()
        .toString(36)
        .toUpperCase();


    const random =
      randomString(
        6
      ).toUpperCase();


    return `${cleanPrefix}-${timestamp}-${random}`;

  }


  /* =======================================================
     URL QUERY PARAMETERS
     ======================================================= */

  function getQueryParam(
    name,
    fallback = ""
  ){

    const key =
      cleanString(name);


    if(!key){
      return fallback;
    }


    try{

      const params =
        new URLSearchParams(
          window.location.search
        );


      const value =
        params.get(key);


      return value === null
        ? fallback
        : value;

    }catch(error){

      return fallback;

    }

  }


  /* =======================================================
     GET ALL QUERY PARAMETERS
     ======================================================= */

  function getQueryParams(){

    try{

      const params =
        new URLSearchParams(
          window.location.search
        );


      const result = {};


      params.forEach(
        (value, key) => {

          result[key] =
            value;

        }
      );


      return result;

    }catch(error){

      return {};

    }

  }


  /* =======================================================
     BUILD URL
     ======================================================= */

  function buildURL(
    path = "",
    params = {}
  ){

    const rawPath =
      safeString(path);


    try{

      const url =
        new URL(
          rawPath,
          window.location.origin
        );


      if(
        isPlainObject(params)
      ){

        Object.entries(params)
          .forEach(
            ([key, value]) => {

              if(
                value === null ||
                value === undefined ||
                value === ""
              ){

                return;

              }


              url.searchParams.set(
                key,
                String(value)
              );

            }
          );

      }


      return url.toString();

    }catch(error){

      return rawPath;

    }

  }


  /* =======================================================
     SCROLL TO ELEMENT
     ======================================================= */

  function scrollToElement(
    elementOrId,
    options = {}
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    try{

      element.scrollIntoView({

        behavior:
          options.behavior ||
          "smooth",

        block:
          options.block ||
          "start",

        inline:
          options.inline ||
          "nearest"

      });


      return true;

    }catch(error){

      element.scrollIntoView();

      return true;

    }

  }


  /* =======================================================
     ALERT ELEMENT RESOLUTION
     -------------------------------------------------------
     Existing ALBUKHR HTML IDs are preserved.
  ======================================================= */

  function getAlertElements(){

    return {

      container:
        getElement(
          "appAlert"
        ),

      title:
        getElement(
          "appAlertTitle"
        ),

      text:
        getElement(
          "appAlertText"
        )

    };

  }


  /* =======================================================
     SHOW ALERT
     -------------------------------------------------------
     Compatibility replacement for:

       showAlert(title, message)

     UI/CSS remains controlled by existing HTML/CSS.
  ======================================================= */

  function showAlert(
    title = "ALBUKHR",
    message = ""
  ){

    const elements =
      getAlertElements();


    if(
      !elements.container
    ){

      console.warn(
        "[ALBUKHR] Alert container #appAlert was not found."
      );


      return false;

    }


    if(elements.title){

      elements.title.innerText =
        safeString(
          title
        );

    }


    if(elements.text){

      elements.text.innerText =
        safeString(
          message
        );

    }


    elements.container.style.display =
      "flex";


    return true;

  }


  /* =======================================================
     CLOSE ALERT
     -------------------------------------------------------
     Compatibility replacement for:

       closeAppAlert()
  ======================================================= */

  function closeAppAlert(){

    const container =
      getElement(
        "appAlert"
      );


    if(!container){

      return false;

    }


    container.style.display =
      "none";


    return true;

  }


  /* =======================================================
     ALERT ERROR
     ======================================================= */

  function showError(
    message,
    title = "Error"
  ){

    return showAlert(
      title,
      message
    );

  }


  /* =======================================================
     ALERT SUCCESS
     ======================================================= */

  function showSuccess(
    message,
    title = "Success"
  ){

    return showAlert(
      title,
      message
    );

  }


  /* =======================================================
     ALERT INFO
     ======================================================= */

  function showInfo(
    message,
    title = "Information"
  ){

    return showAlert(
      title,
      message
    );

  }


  /* =======================================================
     SAFE FUNCTION EXECUTION
     ======================================================= */

  function safeCall(
    callback,
    fallback = null,
    ...args
  ){

    if(
      typeof callback !==
      "function"
    ){

      return fallback;

    }


    try{

      return callback(
        ...args
      );

    }catch(error){

      console.error(
        "[ALBUKHR UTILS] safeCall error:",
        error
      );


      return fallback;

    }

  }


  /* =======================================================
     SAFE ASYNC FUNCTION EXECUTION
     ======================================================= */

  async function safeAsync(
    callback,
    fallback = null,
    ...args
  ){

    if(
      typeof callback !==
      "function"
    ){

      return fallback;

    }


    try{

      return await callback(
        ...args
      );

    }catch(error){

      console.error(
        "[ALBUKHR UTILS] safeAsync error:",
        error
      );


      return fallback;

    }

  }


  /* =======================================================
     ERROR MESSAGE NORMALIZER
     -------------------------------------------------------
     Generic only.
     Business engines may add richer error semantics.
  ======================================================= */

  function getErrorMessage(
    error,
    fallback = "An unexpected error occurred."
  ){

    if(!error){

      return fallback;

    }


    if(
      typeof error ===
      "string"
    ){

      return (
        error.trim() ||
        fallback
      );

    }


    if(
      error.message
    ){

      return (
        safeString(
          error.message
        ).trim() ||
        fallback
      );

    }


    if(
      error.error
    ){

      if(
        typeof error.error ===
        "string"
      ){

        return (
          error.error.trim() ||
          fallback
        );

      }


      if(
        error.error.message
      ){

        return (
          safeString(
            error.error.message
          ).trim() ||
          fallback
        );

      }

    }


    return fallback;

  }


  /* =======================================================
     ERROR LOG
     ======================================================= */

  function logError(
    context,
    error
  ){

    const label =
      cleanString(
        context,
        "ALBUKHR"
      );


    console.error(
      `[${label}]`,
      error
    );

  }


  /* =======================================================
     LOG
     -------------------------------------------------------
     Lightweight shared logger compatibility.
     Full logging policy belongs to logger.js.
  ======================================================= */

  function log(
    ...args
  ){

    console.log(
      "[ALBUKHR]",
      ...args
    );

  }


  function warn(
    ...args
  ){

    console.warn(
      "[ALBUKHR]",
      ...args
    );

  }


  /* =======================================================
     WAIT
     ======================================================= */

  function sleep(
    milliseconds = 0
  ){

    const delay =
      Math.max(
        0,
        safeInteger(
          milliseconds
        )
      );


    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          delay
        )
    );

  }


  /* =======================================================
     WAIT FOR DOM READY
     ======================================================= */

  function domReady(
    callback
  ){

    if(
      typeof callback !==
      "function"
    ){

      return Promise.resolve();

    }


    if(
      document.readyState !==
      "loading"
    ){

      return Promise.resolve(
        callback()
      );

    }


    return new Promise(
      resolve => {

        document.addEventListener(
          "DOMContentLoaded",
          () => {

            resolve(
              callback()
            );

          },
          {
            once:true
          }
        );

      }
    );

  }


  /* =======================================================
     BROWSER ENVIRONMENT
     ======================================================= */

  function isBrowser(){

    return (
      typeof window !==
        "undefined" &&
      typeof document !==
        "undefined"
    );

  }


  /* =======================================================
     MOBILE DETECTION
     -------------------------------------------------------
     Informational only.
     Do not use for authorization/security.
  ======================================================= */

  function isMobile(){

    try{

      return /Android|iPhone|iPad|iPod|Mobile/i
        .test(
          navigator.userAgent
        );

    }catch(error){

      return false;

    }

  }


  /* =======================================================
     ONLINE STATUS
     ======================================================= */

  function isOnline(){

    try{

      return navigator.onLine !== false;

    }catch(error){

      return true;

    }

  }


  /* =======================================================
     FOCUS ELEMENT
     ======================================================= */

  function focusElement(
    elementOrId
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(
      !element ||
      typeof element.focus !==
      "function"
    ){

      return false;

    }


    try{

      element.focus();

      return true;

    }catch(error){

      return false;

    }

  }


  /* =======================================================
     DISABLE ELEMENT
     ======================================================= */

  function setDisabled(
    elementOrId,
    disabled = true
  ){

    const element =
      resolveElement(
        elementOrId
      );


    if(!element){
      return false;
    }


    element.disabled =
      safeBoolean(
        disabled,
        true
      );


    return true;

  }


  /* =======================================================
     DATA ATTRIBUTE
     ======================================================= */

  function getData(
    elementOrId,
    name,
    fallback = ""
  ){

    const element =
      resolveElement(
        elementOrId
      );


    const key =
      cleanString(name);


    if(
      !element ||
      !key
    ){

      return fallback;

    }


    const value =
      element.dataset?.[
        key
      ];


    return value === undefined
      ? fallback
      : value;

  }


  function setData(
    elementOrId,
    name,
    value
  ){

    const element =
      resolveElement(
        elementOrId
      );


    const key =
      cleanString(name);


    if(
      !element ||
      !key
    ){

      return false;

    }


    if(
      !element.dataset
    ){

      return false;

    }


    element.dataset[key] =
      safeString(value);


    return true;

  }


  /* =======================================================
     ARRAY PAGINATION
     ======================================================= */

  function paginate(
    array,
    page = 1,
    pageSize = 20
  ){

    const rows =
      Array.isArray(array)
        ? array
        : [];


    const size =
      Math.max(
        1,
        safeInteger(
          pageSize,
          20
        )
      );


    const currentPage =
      Math.max(
        1,
        safeInteger(
          page,
          1
        )
      );


    const start =
      (
        currentPage -
        1
      ) * size;


    const items =
      rows.slice(
        start,
        start + size
      );


    return {

      items,

      page:
        currentPage,

      pageSize:
        size,

      total:
        rows.length,

      totalPages:
        Math.max(
          1,
          Math.ceil(
            rows.length /
            size
          )
        ),

      hasNext:
        start + size <
        rows.length,

      hasPrevious:
        currentPage > 1

    };

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  const API = {

    version:
      VERSION,


    /* Values */

    safeString,

    cleanString,

    safeNumber,

    safeInteger,

    positiveNumber,

    safeBoolean,


    /* Strings */

    lower,

    upper,

    normalizeSpaces,

    normalizeKey,

    slugify,

    toSnakeCase,

    toCamelCase,

    escapeRegExp,


    /* Arrays / objects */

    isEmpty,

    isPlainObject,

    toArray,

    unique,

    uniqueBy,

    findByKey,

    clamp,

    round,

    merge,

    hasOwn,

    getPath,

    setPath,

    clone,


    /* Numbers */

    formatNumber,

    formatAmount,


    /* Date / time */

    nowISO,

    parseDate,

    formatDate,

    formatDateOnly,

    formatTimeOnly,

    differenceInMilliseconds,


    /* Browser */

    isBrowser,

    isMobile,

    isOnline,


    /* Clipboard */

    copyToClipboard,


    /* DOM */

    $,

    $$,

    getElement,

    elementExists,

    resolveElement,

    setText,

    setHTML,

    showElement,

    hideElement,

    toggleElement,

    addClass,

    removeClass,

    toggleClass,

    setAttribute,

    removeAttribute,

    focusElement,

    setDisabled,

    getData,

    setData,


    /* Events */

    on,

    off,

    delegate,

    dispatch,


    /* Timing */

    debounce,

    throttle,

    nextFrame,

    sleep,


    /* JSON */

    parseJSON,

    stringifyJSON,


    /* References */

    randomString,

    createReference,


    /* URL */

    getQueryParam,

    getQueryParams,

    buildURL,

    scrollToElement,


    /* Alerts */

    getAlertElements,

    showAlert,

    closeAppAlert,

    showError,

    showSuccess,

    showInfo,


    /* Error helpers */

    safeCall,

    safeAsync,

    getErrorMessage,

    logError,


    /* Lightweight logging */

    log,

    warn,


    /* DOM lifecycle */

    domReady,


    /* UI */

    paginate

  };


  /* =======================================================
     CANONICAL NAMESPACE
  ======================================================= */

  window.ALBUKHR_UTILS =
    Object.freeze(
      API
    );


  /* =======================================================
     LEGACY COMPATIBILITY EXPORTS
     -------------------------------------------------------
     These are intentionally retained so existing HTML
     pages do not immediately break during migration.

     They are compatibility bridges, not separate engines.
  ======================================================= */

  window.showAlert =
    showAlert;


  window.closeAppAlert =
    closeAppAlert;


  window.safeString =
    window.safeString ||
    safeString;


  window.safeNumber =
    window.safeNumber ||
    safeNumber;


  window.normalizeKey =
    window.normalizeKey ||
    normalizeKey;


  window.slugify =
    window.slugify ||
    slugify;


  window.formatNumber =
    window.formatNumber ||
    formatNumber;


  window.copyToClipboard =
    window.copyToClipboard ||
    copyToClipboard;


  window.getQueryParam =
    window.getQueryParam ||
    getQueryParam;


  window.getQueryParams =
    window.getQueryParams ||
    getQueryParams;


  window.getErrorMessage =
    window.getErrorMessage ||
    getErrorMessage;


  /* =======================================================
     DEVELOPMENT HEALTH INFORMATION
  ======================================================= */

  try{

    window.ALBUKHR_UTILS_READY = {

      version:
        VERSION,

      loaded:
        true,

      localStorage:
        false,

      sessionStorage:
        false,

      supabase:
        false,

      piSdk:
        false,

      networkOwnership:
        false,

      businessLogic:
        false

    };

  }catch(error){

    /*
      Utility initialization should never fail because
      health metadata could not be assigned.
    */

  }


})(window, document);
