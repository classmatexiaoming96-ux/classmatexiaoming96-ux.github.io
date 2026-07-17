/* AI Daily Digest explorer views: latest feed and topic archive. */
(function () {
  "use strict";

  const sectionOrder = ["headlines", "papers", "community", "products", "repos"];
  const sectionLabels = {
    headlines: "今日要闻",
    papers: "AI 论文",
    community: "社区热议",
    products: "产品 / 概念",
    repos: "开源热门",
  };
  const sectionColors = {
    headlines: "var(--gold)",
    papers: "#ff8fa3",
    community: "var(--cyan)",
    products: "var(--violet)",
    repos: "var(--green)",
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function button(label, pressed, onClick) {
    const node = el("button", "", label);
    node.type = "button";
    node.setAttribute("aria-pressed", pressed ? "true" : "false");
    node.addEventListener("click", onClick);
    return node;
  }

  async function getJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  function metricText(item) {
    const bits = [];
    if (item.source_count > 1) bits.push(item.source_count + " 个来源");
    if (item.points !== null && item.points !== undefined) bits.push("▲ " + item.points);
    if (item.comments !== null && item.comments !== undefined) bits.push(item.comments + " 条评论");
    if (item.stars_today) bits.push("今日 +" + item.stars_today);
    else if (item.stars) bits.push("★ " + item.stars);
    return bits.join(" · ");
  }

  function makeSignalRow(item) {
    const link = el("a", "signal-row");
    link.href = item.url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.style.setProperty("--accent", sectionColors[item.section] || "var(--gold)");

    link.appendChild(el("div", "signal-section", item.section_label || sectionLabels[item.section] || item.section));
    const main = el("div", "signal-main");
    main.appendChild(el("h2", "", item.title));
    if (item.summary) main.appendChild(el("p", "", item.summary));
    if (item.topics && item.topics.length) {
      const topics = el("div", "signal-topics");
      item.topics.slice(0, 4).forEach(topic => topics.appendChild(el("span", "signal-topic", topic)));
      main.appendChild(topics);
    }
    link.appendChild(main);

    const side = el("div", "signal-side");
    side.appendChild(el("div", "signal-source", item.source || "原始信源"));
    const metric = metricText(item);
    if (metric) side.appendChild(el("div", "signal-metric", metric));
    link.appendChild(side);
    return link;
  }

  async function initFeed() {
    const coverage = document.getElementById("coverageLine");
    const issueLink = document.getElementById("issueLink");
    const search = document.getElementById("feedSearch");
    const sectionFilters = document.getElementById("sectionFilters");
    const topicFilters = document.getElementById("topicFilters");
    const list = document.getElementById("feedList");
    const empty = document.getElementById("feedEmpty");

    try {
      const data = await getJson("api/latest.json");
      document.title = "AI 动态流 · " + data.date;
      issueLink.href = "index.html#" + data.date;
      coverage.textContent = "";
      const issue = el("span", "coverage-stat issue");
      issue.appendChild(el("b", "", data.date));
      issue.append("第 " + data.edition + " 期");
      coverage.appendChild(issue);
      [[data.coverage.items, "条精选"], [data.coverage.sources, "个来源"], [data.coverage.topics, "个主题"]]
        .forEach(([value, label]) => {
          const stat = el("span", "coverage-stat");
          stat.appendChild(el("b", "", value));
          stat.append(label);
          coverage.appendChild(stat);
        });

      let activeSection = "all";
      let activeTopic = "";
      let query = "";

      function renderSectionFilters() {
        sectionFilters.textContent = "";
        const options = [{ key: "all", label: "全部 " + data.items.length }];
        sectionOrder.forEach(key => {
          const count = data.counts[key] || 0;
          if (count) options.push({ key, label: sectionLabels[key] + " " + count });
        });
        options.forEach(option => {
          sectionFilters.appendChild(button(option.label, option.key === activeSection, () => {
            activeSection = option.key;
            renderSectionFilters();
            render();
          }));
        });
      }

      function renderTopicFilters() {
        topicFilters.textContent = "";
        data.topics.slice(0, 10).forEach(topic => {
          topicFilters.appendChild(button(topic.name, topic.name === activeTopic, () => {
            activeTopic = activeTopic === topic.name ? "" : topic.name;
            renderTopicFilters();
            render();
          }));
        });
      }

      function render() {
        const normalized = query.trim().toLocaleLowerCase("zh-CN");
        const visible = data.items.filter(item => {
          if (activeSection !== "all" && item.section !== activeSection) return false;
          if (activeTopic && !(item.topics || []).includes(activeTopic)) return false;
          if (!normalized) return true;
          const haystack = [item.title, item.summary, item.source].concat(item.topics || []).join(" ").toLocaleLowerCase("zh-CN");
          return haystack.includes(normalized);
        });
        list.textContent = "";
        visible.forEach(item => list.appendChild(makeSignalRow(item)));
        empty.hidden = visible.length !== 0;
      }

      search.addEventListener("input", () => { query = search.value; render(); });
      renderSectionFilters();
      renderTopicFilters();
      render();
    } catch (error) {
      coverage.textContent = "最新动态载入失败";
      coverage.classList.add("error-state");
      empty.hidden = false;
      empty.textContent = "数据暂不可用";
      empty.classList.add("error-state");
    }
  }

  function makeTopicItem(item) {
    const link = el("a", "topic-item");
    link.href = item.url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.appendChild(el("div", "topic-item-date", item.date));
    const body = el("div", "");
    body.appendChild(el("h3", "", item.title));
    if (item.summary) body.appendChild(el("p", "", item.summary));
    body.appendChild(el("div", "topic-item-meta", [item.section_label, item.source].filter(Boolean).join(" · ")));
    link.appendChild(body);
    return link;
  }

  async function initTopics() {
    const archiveRange = document.getElementById("archiveRange");
    const search = document.getElementById("topicSearch");
    const index = document.getElementById("topicIndex");
    const detail = document.getElementById("topicDetail");
    const sourceList = document.getElementById("sourceList");
    const sourceCount = document.getElementById("sourceCount");

    try {
      const data = await getJson("api/archive.json");
      const dates = data.digests.map(digest => digest.date).filter(Boolean);
      archiveRange.textContent = dates.length ? dates[dates.length - 1] + " 至 " + dates[0] : "暂无刊期";
      sourceCount.textContent = data.sources.length + " 个来源";
      data.sources.slice(0, 24).forEach(source => {
        const entry = el("div", "source-entry");
        entry.appendChild(el("span", "", source.name));
        entry.appendChild(el("span", "", source.count));
        sourceList.appendChild(entry);
      });

      const requested = new URLSearchParams(location.search).get("topic");
      let active = data.topics.find(topic => topic.name === requested) || data.topics[0] || null;
      let query = "";

      function visibleTopics() {
        const normalized = query.trim().toLocaleLowerCase("zh-CN");
        return data.topics.filter(topic => !normalized || topic.name.toLocaleLowerCase("zh-CN").includes(normalized));
      }

      function paintIndex() {
        index.textContent = "";
        visibleTopics().forEach(topic => {
          const node = button(topic.name, active && topic.name === active.name, () => {
            active = topic;
            history.replaceState(null, "", "?topic=" + encodeURIComponent(topic.name));
            paintIndex();
            paintDetail();
          });
          node.appendChild(el("span", "", topic.count));
          index.appendChild(node);
        });
      }

      function paintDetail() {
        detail.textContent = "";
        if (!active) {
          detail.appendChild(el("div", "empty-state", "暂无主题"));
          return;
        }
        const summary = el("header", "topic-summary");
        summary.appendChild(el("h2", "", active.name));
        const sectionText = (active.sections || []).map(item => item.name + " " + item.count).join(" · ");
        summary.appendChild(el("p", "", active.count + " 条动态 · " + active.dates.length + " 个刊期" + (sectionText ? " · " + sectionText : "")));
        detail.appendChild(summary);
        active.items.forEach(item => detail.appendChild(makeTopicItem(item)));
      }

      search.addEventListener("input", () => { query = search.value; paintIndex(); });
      paintIndex();
      paintDetail();
    } catch (error) {
      archiveRange.textContent = "主题数据载入失败";
      archiveRange.classList.add("error-state");
      detail.textContent = "";
      detail.appendChild(el("div", "empty-state error-state", "数据暂不可用"));
    }
  }

  const view = document.body.dataset.view;
  if (view === "feed") initFeed();
  if (view === "topics") initTopics();
}());
