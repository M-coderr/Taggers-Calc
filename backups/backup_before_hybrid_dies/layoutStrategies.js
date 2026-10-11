// layoutStrategies.js
// Each strategy defines how tags are oriented on a piece.
// enabled: false strategies are skipped during optimization but retained for future use.
// overlap is ALWAYS applied regardless of gutter flags (geometry requirement).

var LayoutStrategies = [

    {
        id: "NORMAL",
        name: "Normal",
        rotate: false,
        enabled: true,
        priority: 1
    },

    {
        id: "ROTATED",
        name: "Rotated",
        rotate: true,
        enabled: true,
        priority: 2
    },

    {
        id: "NO_HORIZONTAL_GUTTER",
        name: "No Horizontal Gutter",
        rotate: false,
        enabled: false,
        disabledReason: "Overlap must always be applied for physical cutting accuracy.",
        priority: 3
    },

    {
        id: "NO_VERTICAL_GUTTER",
        name: "No Vertical Gutter",
        rotate: false,
        enabled: false,
        disabledReason: "Overlap must always be applied for physical cutting accuracy.",
        priority: 4
    },

    {
        id: "NO_GUTTERS",
        name: "No Gutters",
        rotate: false,
        enabled: false,
        disabledReason: "Overlap must always be applied for physical cutting accuracy.",
        priority: 5
    }

];

console.log("LayoutStrategies loaded", LayoutStrategies);