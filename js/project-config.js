/* ======================================
   ALBUKHR – CORE PROJECT CONFIG SYSTEM
====================================== */

const PROJECT_CONFIG = {

  Azman:{
    title:"Azman Futures Makers Lab",
    icon:"🧪",
    desc:"Long-term science, technology, and innovation project focused on future invention and engineering.",
    info:"Azman supports research labs, prototyping, and advanced engineering capacity building.",
    durations:[180,365,430]
  },

  Labbaika:{
    title:"Labbaika Bakery Center",
    icon:"🍞",
    desc:"Food production project focused on modern bread and flour processing.",
    info:"Labbaika enables scalable bakery production within the ALBUKHR ecosystem.",
    durations:[30,60,90]
  },

  Barsh:{
    title:"Barsh Agro & Livestock",
    icon:"🌾",
    desc:"Mechanized farming and livestock project for large-scale agricultural production.",
    info:"Barsh integrates modern farming, livestock, and sustainable agriculture systems.",
    durations:[30,60,90]
  },

  Urban:{
    title:"Urban Mobility System",
    icon:"🚍",
    desc:"Infrastructure project focused on modern transportation of people and goods.",
    info:"Urban improves accessibility and builds sustainable mobility networks.",
    durations:[30,60,90]
  },

  Khairat:{
    title:"Khairat Fertiliser",
    icon:"♻️",
    desc:"Agricultural supply project improving fertiliser access and farm productivity.",
    info:"Khairat supports transparent distribution systems and sustainable farming inputs.",
    durations:[30,60,90]
  },

  Hauwal:{
    title:"Hauwal Maize Processing",
    icon:"🌽",
    desc:"Agro-processing project modernizing maize milling into scalable production.",
    info:"Hauwal focuses on clean processing, packaging, and food system efficiency.",
    durations:[30,60,90]
  },

  Raheem:{
    title:"Raheem Pharmacy",
    icon:"💊",
    desc:"Healthcare project improving access to essential medicines.",
    info:"Raheem provides transparent, community-driven pharmaceutical distribution.",
    durations:[30,60,90]
  }

};

/* ======================================
   HELPER (SAFE ACCESS)
====================================== */
function getProjectConfig(name){
  return PROJECT_CONFIG[name] || {
    title:name,
    icon:"📦",
    desc:"Albukhr Project",
    info:"Project information not available.",
    durations:[30,60,90]
  };
}
