/**
 * Cheshire Terminal CLI brand banner (Ink + React).
 * createElement only — no JSX build step required for npm publish.
 */
import React from "react";
import { Box, Text } from "ink";
import { getBannerModel } from "./banner-data.mjs";

/**
 * @param {{ siteUrl?: string, compact?: boolean }} props
 */
export function Banner({ siteUrl, compact = false } = {}) {
  const data = getBannerModel({ siteUrl });

  if (compact) {
    return React.createElement(
      Box,
      { flexDirection: "column", marginBottom: 1 },
      React.createElement(Text, { bold: true, color: "cyan" }, data.brand),
      React.createElement(
        Text,
        { dimColor: true },
        `${data.name} · `,
        React.createElement(Text, { color: "green" }, data.siteUrl),
      ),
    );
  }

  return React.createElement(
    Box,
    { flexDirection: "column", marginBottom: 1 },
    React.createElement(Text, { bold: true, color: "cyan" }, `  ${data.brand}`),
    React.createElement(Text, { color: "magenta" }, `  ${data.subtitle}`),
    React.createElement(
      Text,
      { dimColor: true },
      "  cli   ",
      React.createElement(Text, { color: "cyan" }, data.name),
      " · npm ",
      React.createElement(Text, { color: "cyan" }, data.packageName),
    ),
    React.createElement(
      Text,
      { dimColor: true },
      "  site  ",
      React.createElement(Text, { color: "green" }, data.siteUrl),
    ),
    React.createElement(
      Text,
      { dimColor: true },
      "  hubs  ",
      React.createElement(Text, { color: "green" }, data.hub),
      " · ",
      React.createElement(Text, { color: "green" }, data.forge),
    ),
    React.createElement(
      Text,
      { dimColor: true },
      "  mode  ",
      React.createElement(Text, { color: "gray" }, data.modeLine),
    ),
  );
}

export default Banner;
