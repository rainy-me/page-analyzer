import puppeteer, { Browser } from "puppeteer";
import path from "path";
// import fs from "fs";
// import { v2 as cloudinary } from "cloudinary";

export type Node = {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  width?: number;
  height?: number;
  selector: string;
  type: "box" | "font" | "box-target" | "font-target";
  text?: string;
};

export type Link = { source: number; target: number };

let browserCache: Browser | undefined;

export const run = async (url: string): Promise<string | undefined> => {
  // if (!process.env.CLOUDINARY_URL) {
  //   throw new Error("no env");
  // }
  // console.log(process.env.CLOUDINARY_URL);
  if (typeof url !== "string") return;
  if (!url.startsWith("http")) {
    url = `https://` + url;
  }
  // const filename = url.replace(/[^a-zA-Z]+/g, "-").replace(/-$/, "");
  // const fileDone = path.join("/tmp/", `${filename}.png`);
  // try {
  //   const url: string | undefined = await new Promise((res) => {
  //     try {
  //       cloudinary.api
  //         .resource(filename, (error, result) => {
  //           if (result) {
  //             console.log("exist!");
  //             res(result.secure_url);
  //           } else {
  //             res(undefined);
  //           }
  //         })
  //         .catch(() => {
  //           res(undefined);
  //         });
  //     } catch {
  //       res(undefined);
  //     }
  //   });
  //   if (url) return url;
  // } catch {}
  let browser = browserCache;
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--disable-web-security"],
    });
  }

  let page = await browser.newPage();
  await page.setBypassCSP(true);
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.waitFor(5000);
  // await browser.close();

  const maxHeight = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;

    return Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );
  });
  await page.setViewport({ width: 1400, height: maxHeight });
  console.log(`resize to ${maxHeight}`);
  await page.waitFor(1000);

  const data = await page.evaluate(() => {
    const is = <T>(_: unknown, y: boolean): _ is T => y;

    function isInView({
      top,
      left,
      // bottom,
      right,
    }: {
      top: number;
      left: number;
      bottom: number;
      right: number;
    }) {
      return (
        top >= 0 &&
        left >= 0 &&
        // bottom && // not check this one
        // bottom <=
        //   (window.innerHeight ||
        //     document.documentElement
        //       .clientHeight) &&
        right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    }

    const nodes: Node[] = [];
    const links: { source: number; target: number }[] = [];
    const medias: string[] = [];
    let fontLabelY = 200;
    let boxLabelY = 200;
    const fontStyles: Record<string, { from: number; to: number[] }> = {};
    const boxStyles: Record<string, { from: number; to: number[] }> = {};

    for (const styleSheet of Array.from(document.styleSheets)) {
      const rules = Array.from(styleSheet.cssRules);
      for (const rule of rules) {
        if (is<CSSStyleRule>(rule, rule.type === CSSRule.STYLE_RULE)) {
          // const props = Array.from(rule.style);

          const font: Record<string, string> = {};
          const box: Record<string, string> = {};
          for (const name of Object.keys(rule.style)) {
            if (
              name.includes("font") &&
              //@ts-ignore
              rule.style[name] &&
              //@ts-ignore
              rule.style[name] !== "inherit"
            ) {
              //@ts-ignore
              font[name] = rule.style[name];
            }

            if (
              (name.includes("padding") ||
                name.includes("margin") ||
                name.includes("width") ||
                name.includes("height")) &&
              //@ts-ignore
              rule.style[name] &&
              //@ts-ignore
              rule.style[name] !== "0px" &&
              //@ts-ignore
              rule.style[name] !== "0"
            ) {
              //@ts-ignore
              box[name] = rule.style[name];
            }
          }

          if (Object.keys(font).length) {
            for (const el of Array.from(
              document.querySelectorAll(rule.selectorText)
            )) {
              // const toMark = el;
              const {
                x, // format
                y, // format
                width, // format
                height, // format
                top,
                left,
                bottom,
                right,
              } = el.getBoundingClientRect();
              if (!isInView({ top, left, bottom, right })) {
                continue;
              }
              const fx = 500 + (x + width / 2) ?? -200;
              const fy = 200 + (y + height / 2);
              nodes.push({
                type: "font-target",
                fx, // format
                fy, // format
                width, // format
                height, // format
                selector: rule.selectorText,
              });
              const text = JSON.stringify(font, null, 4)
                .replace("{\n", "")
                .replace("\n}", "");
              if (fontStyles[text]) {
                fontStyles[text].to.push(nodes.length - 1);
              } else {
                nodes.push({
                  type: "font",
                  fx: 2000, // format
                  fy: fontLabelY, // format
                  text,
                  selector: rule.selectorText,
                });
                fontStyles[text] = {
                  from: nodes.length - 1,
                  to: [nodes.length - 2],
                };
                const lines = text.split("\n");
                fontLabelY +=
                  (lines.reduce(
                    (acc, curr) => acc + Math.floor(curr.length / 40),
                    Math.floor(rule.selectorText.length / 40)
                  ) +
                    lines.length +
                    4) *
                  20;
              }
            }
          }

          if (Object.keys(box).length) {
            for (const el of Array.from(
              document.querySelectorAll(rule.selectorText)
            )) {
              // const toMark = el;
              const {
                x, // format
                y, // format
                width, // format
                height, // format
                top,
                left,
                bottom,
                right,
              } = el.getBoundingClientRect();
              if (!isInView({ top, left, bottom, right })) {
                continue;
              }
              const fx = 500 + x;
              const fy = 200 + y;
              nodes.push({
                type: "box-target",
                fx, // format
                fy, // format
                width, // format
                height, // format
                selector: rule.selectorText,
              });
              const text = JSON.stringify(box, null, 4)
                .replace("{\n", "")
                .replace("\n}", "");
              if (boxStyles[text]) {
                boxStyles[text].to.push(nodes.length - 1);
              } else {
                nodes.push({
                  type: "box",
                  fx: 100, // format
                  fy: boxLabelY, // format
                  text,
                  selector: rule.selectorText,
                });
                boxStyles[text] = {
                  from: nodes.length - 1,
                  to: [nodes.length - 2],
                };
                const lines = text.split("\n");
                boxLabelY +=
                  (lines.reduce(
                    (acc, curr) => acc + Math.floor(curr.length / 40),
                    Math.floor(rule.selectorText.length / 40)
                  ) +
                    lines.length +
                    4) *
                  20;
              }
            }
          }
        }

        if (is<CSSMediaRule>(rule, rule.type === CSSRule.MEDIA_RULE)) {
          medias.push(rule.media.mediaText);
        }
      }
    }
    Object.values(fontStyles).forEach((style) => {
      style.to.forEach((to) => {
        links.push({
          source: style.from,
          target: to,
        });
      });
    });

    Object.values(boxStyles).forEach((style) => {
      style.to.forEach((to) => {
        links.push({
          source: style.from,
          target: to,
        });
      });
    });

    return { nodes, links, medias };
  });
  const base64 = await page.screenshot({ fullPage: true, encoding: "base64" });

  const pathToHtml = path.join(__dirname, `../render.html`);
  page = await browser.newPage();
  await page.goto(`http://localhost:3000/render.html`, {
    waitUntil: "networkidle0",
  });
  await page.setViewport({ width: 2400, height: 1000 });

  await page.addScriptTag({
    content: `window.data=${JSON.stringify({
      title: `url: ${url} <br> time: ${new Date().toISOString()}`,
      file: `data:image/png;base64,` + base64,
      ...data,
    })};
  `,
  });

  await page.evaluate(async () => {
    const img = document.querySelector("img")!;
    img.src = window.data.file;
    return new Promise((res) => (img.onload = res));
  });

  await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;

    const maxHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );

    const svg = window.d3
      .select("body")
      .append("svg")
      .attr("xmlns", "http://www.w3.org/2000/svg")
      .style("position", "absolute")
      .style("top", 0)
      .style("left", 0)
      .style("z-index", Number.MAX_SAFE_INTEGER.toString())
      .attr("width", 2400)
      .attr("height", maxHeight);
    // use foreignObject instead
    // const filter = svg
    //   .append("defs")
    //   .append("filter")
    //   .attr("id", "text-bg")
    //   .attr("x", 0)
    //   .attr("y", 0)
    //   .attr("width", 1)
    //   .attr("height", 1);
    // filter.append("feFlood").attr("flood-color", "white");
    // filter
    //   .append("feComposite")
    //   .attr("in", "SourceGraphic")
    //   .attr("operator", "xor");

    const { nodes, links } = window.data;

    const simulation = window.d3
      .forceSimulation()

      .nodes(nodes)
      .force("charge", window.d3.forceManyBody())
      .force("link", window.d3.forceLink(links).distance(100))
      //   .force("center", window.d3.forceCenter(700, 200))
      .force("x", window.d3.forceX())
      .force("y", window.d3.forceY())
      .on("tick", ticked);

    let link = svg
      .append("g")
      .attr("fill", "none")
      .attr("stroke-width", 1)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line");

    let node = svg
      .append("g")
      .attr("fill", "none")
      .attr("stroke-width", 1)
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g");

    node
      .filter((d: Node) => d.type === "font-target")
      .append("circle")
      .attr("r", 8)
      .attr("stroke", "black")
      .attr("fill", "#fff")
      .attr("fill-opacity", 0.5);

    node
      .filter((d: Node) => d.type === "box-target")
      .append("rect")
      // .attr("x", (d: Node) => d.x as any)
      // .attr("y", (d: Node) => d.y as any)
      .attr("width", (d: Node) => d.width as any)
      .attr("height", (d: Node) => d.height as any)
      .attr("stroke", "red");

    const info = node
      .filter((d: Node) => d.type === "box" || d.type === "font")
      .append("foreignObject")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 400)
      .attr("height", 50)
      .style("overflow", "visible")
      .append("xhtml:div")
      .attr("xmlns", "http://www.w3.org/1999/xhtml")
      .style("width", 400)
      .style("height", 50)
      .style("white-space", "pre-line")
      .style("padding", "10px")
      .style("font-size", "14px")
      .style("text-align", "left")
      .style("transform", "translateY(-10px)")
      .style("font-size", "16px");
    info
      .append("xhtml:div")
      .text((d: Node) => d.selector)
      .style("color", "hotpink")
      .style("font-weight", "bold");
    info.append("xhtml:div").text((d: any) => d.text);
    // .attr("stroke", "#fff");

    // node
    //   .append("text")
    //   // .attr("stroke", "black")
    //   .attr("fill", "black")
    //   // .style("text-anchor", "middle")
    //   .attr("x", 8)
    //   .attr("y", "0.31em")
    //   .text((d: any) => d.text)
    //   //   .attr("stroke", "#fff")
    //   .attr("stroke-width", 1);

    function ticked() {
      link
        .filter((d: any) => d.source.type === "box")
        .attr("x1", (d: any) => d.source.x + 200)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);

      link
        .filter((d: any) => d.source.type === "font")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);

      node.attr("transform", (d) => {
        return "translate(" + d.x + "," + d.y + ")";
      });
    }
  });
  await page.waitFor(1000);
  await page.evaluate(() => {
    document.querySelector("h1")!.innerHTML = window.data.title;
    const ml = document.querySelector("ul")!;
    window.data.medias.forEach((m) => {
      const li = document.createElement("li");
      li.textContent = m;
      ml.appendChild(li);
    });
    const svg = document.querySelector("svg")!;
    const bbox = svg.getBBox()!;
    // Update the width and height using the size of the contents
    svg?.setAttribute("height", (bbox.y + bbox.height + bbox.y).toString());
  });
  const b64Url = await page.screenshot({
    fullPage: true,
    encoding: "base64",
  });

  return `data:image/png;base64,${b64Url}`;
  // return new Promise((res, rej) => {
  //   cloudinary.uploader.upload(
  //     fileDone,
  //     {
  //       public_id: filename,
  //       overwrite: true,
  //     },
  //     (error, result) => {
  //       if (error) {
  //         rej(error);
  //         return;
  //       }
  //       try {
  //         fs.unlinkSync(fileDone);
  //       } catch {}
  //       res(result?.secure_url);
  //     }
  //   );
  // });
};
