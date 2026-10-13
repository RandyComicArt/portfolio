# app.R
# Video Game Sales Explorer (1980-2024)
# Expects Video_Games_Sales.csv in the same directory.

library(shiny)
library(dplyr)
library(ggplot2)
library(scales)

csv_path <- "Video_Games_Sales.csv"
if (!file.exists(csv_path)) {
  stop("Could not find Video_Games_Sales.csv in the current working directory.")
}

raw <- read.csv(csv_path, stringsAsFactors = FALSE, check.names = FALSE)

norm_names <- function(x) {
  x <- tolower(x)
  x <- gsub("[^a-z0-9]+", "_", x)
  gsub("(^_|_$)", "", x)
}

names(raw) <- norm_names(names(raw))

pick_col <- function(df, candidates) {
  hit <- intersect(candidates, names(df))
  if (length(hit) == 0) NA_character_ else hit[[1]]
}

safe_choices <- function(df, col) {
  if (is.na(col) || !col %in% names(df)) return(character(0))
  vals <- unique(df[[col]])
  vals <- vals[!is.na(vals) & vals != ""]
  sort(as.character(vals))
}

fmt_millions <- function(x) number(x, accuracy = 0.01)
fmt_sales <- function(x) paste0(number(x, accuracy = 0.01), "M")

display_col_label <- function(col_name) {
  switch(
    col_name,
    title = "Title",
    name = "Title",
    game = "Title",
    release_year = "Release Year",
    year = "Release Year",
    year_of_release = "Release Year",
    release_date = "Release Year",
    console = "Platform",
    platform = "Platform",
    genre = "Genre",
    publisher = "Publisher",
    developer = "Developer",
    critic_score = "Critic Score",
    user_score = "User Score",
    total_sales = "Global Sales (M)",
    global_sales = "Global Sales (M)",
    na_sales = "North America Sales (M)",
    eu_sales = "Europe Sales (M)",
    pal_sales = "PAL Sales (M)",
    jp_sales = "Japan Sales (M)",
    other_sales = "Other Sales (M)",
    rating = "Rating",
    esrb_rating = "Rating",
    tools::toTitleCase(gsub("_", " ", col_name))
  )
}

plot_theme <- function() {
  theme_minimal(base_size = 12) +
    theme(
      panel.grid.minor = element_blank(),
      panel.grid.major.x = element_line(color = "#e5e7eb"),
      panel.grid.major.y = element_line(color = "#eef2f7"),
      plot.background = element_rect(fill = "transparent", color = NA),
      panel.background = element_rect(fill = "transparent", color = NA),
      axis.text = element_text(color = "#6b7280"),
      axis.title = element_text(color = "#374151"),
      plot.title = element_text(face = "bold", color = "#111827"),
      plot.subtitle = element_text(color = "#6b7280")
    )
}

name_col     <- pick_col(raw, c("name", "game", "title", "game_title"))
year_col     <- pick_col(raw, c("year_of_release", "year", "release_year", "release_date"))
platform_col <- pick_col(raw, c("platform", "console", "system"))
genre_col    <- pick_col(raw, c("genre", "category"))
pub_col      <- pick_col(raw, c("publisher", "pub"))
dev_col      <- pick_col(raw, c("developer", "dev"))
rating_col   <- pick_col(raw, c("rating", "esrb_rating"))
na_col       <- pick_col(raw, c("na_sales", "north_america_sales", "us_sales"))
eu_col       <- pick_col(raw, c("eu_sales", "europe_sales", "pal_sales"))
jp_col       <- pick_col(raw, c("jp_sales", "japan_sales"))
other_col    <- pick_col(raw, c("other_sales", "rest_of_world_sales"))
global_col   <- pick_col(raw, c("global_sales", "worldwide_sales", "total_sales"))
critic_col   <- pick_col(raw, c("critic_score", "metascore", "critic_rating"))
user_col     <- pick_col(raw, c("user_score", "user_rating"))
img_col      <- pick_col(raw, c("img", "image", "cover_image", "box_art"))

required_cols <- c(name_col, year_col, global_col)
if (any(is.na(required_cols))) {
  stop(paste0("The CSV is missing one or more required columns. Found: ", paste(names(raw), collapse = ", ")))
}

clean <- raw

text_cols <- unique(na.omit(c(name_col, platform_col, genre_col, pub_col, dev_col, rating_col)))
if (length(text_cols) > 0) {
  clean[text_cols] <- lapply(clean[text_cols], function(x) {
    x <- as.character(x)
    ifelse(is.na(x) | x == "", "Unknown", x)
  })
}

year_num_col <- if (!is.na(year_col) && !identical(year_col, "release_date")) year_col else NA_character_
num_cols <- unique(na.omit(c(year_num_col, na_col, eu_col, jp_col, other_col, global_col, critic_col, user_col)))
if (length(num_cols) > 0) {
  clean[num_cols] <- lapply(clean[num_cols], function(x) suppressWarnings(as.numeric(x)))
}
if (!is.na(year_col) && identical(year_col, "release_date")) {
  clean[[year_col]] <- suppressWarnings(as.integer(substr(clean[[year_col]], 1, 4)))
} else {
  clean[[year_col]] <- as.integer(clean[[year_col]])
}

min_year <- min(clean[[year_col]], na.rm = TRUE)
max_year <- max(clean[[year_col]], na.rm = TRUE)
dataset_rows <- nrow(clean)
dataset_titles <- length(unique(clean[[name_col]]))
dataset_platforms <- if (!is.na(platform_col)) length(unique(clean[[platform_col]])) else NA_integer_

platform_choices <- c("All", safe_choices(clean, platform_col))
genre_choices    <- c("All", safe_choices(clean, genre_col))
publisher_choices <- c("All", safe_choices(clean, pub_col))
developer_choices <- c("All", safe_choices(clean, dev_col))
rating_choices   <- c("All", safe_choices(clean, rating_col))

available_filter_labels <- c(
  if (!is.na(platform_col)) "platform",
  if (!is.na(genre_col)) "genre",
  if (!is.na(pub_col)) "publisher",
  if (!is.na(dev_col)) "developer",
  if (!is.na(rating_col)) "rating"
)

filter_story <- if (length(available_filter_labels) > 0) {
  paste(available_filter_labels, collapse = ", ")
} else {
  "available fields"
}

metric_choices <- c("Global Sales" = "global")
if (!is.na(na_col)) metric_choices <- c(metric_choices, "North America Sales" = "na")
if (!is.na(eu_col)) metric_choices <- c(metric_choices, "Europe Sales" = "eu")
if (!is.na(jp_col)) metric_choices <- c(metric_choices, "Japan Sales" = "jp")
if (!is.na(other_col)) metric_choices <- c(metric_choices, "Other Sales" = "other")
if (!is.na(critic_col)) metric_choices <- c(metric_choices, "Critic Score" = "critic")
metric_choices <- c(metric_choices, "Newest Release Year" = "year_desc", "Oldest Release Year" = "year_asc", "Title (A-Z)" = "title_asc")

sales_metric_label <- function(metric) {
  switch(metric,
         global = "Global Sales",
         na = "North America Sales",
         eu = "Europe Sales",
         jp = "Japan Sales",
         other = "Other Sales",
         critic = "Critic Score",
         year_desc = "Newest Release Year",
         year_asc = "Oldest Release Year",
         title_asc = "Title (A-Z)",
         "Global Sales"
  )
}

ui <- fluidPage(
  tags$head(
    tags$link(rel = "preconnect", href = "https://fonts.googleapis.com"),
    tags$link(rel = "preconnect", href = "https://fonts.gstatic.com", crossorigin = "anonymous"),
    tags$link(href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap", rel = "stylesheet"),
    tags$style(HTML("\
      :root {\
        --bg-soft: #f7f9fc;\
        --line-soft: #e5e7eb;\
        --text-muted: #6b7280;\
        --text-strong: #111827;\
        --blue-600: #2563eb;\
        --teal-700: #0f766e;\
      }\
      body {\
        font-family: 'Inter', sans-serif;\
        background: linear-gradient(180deg, #f7f9fc 0%, #ffffff 100%);\
      }\
      .container-fluid {\
        padding-left: 22px;\
        padding-right: 22px;\
      }\
      .app-shell {\
        max-width: 1500px;\
        margin: 0 auto;\
      }\
      .hero {\
        background: linear-gradient(135deg, #111827 0%, #1f2937 55%, #334155 100%);\
        color: white;\
        border-radius: 24px;\
        padding: 26px 28px;\
        margin: 18px 0 18px 0;\
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);\
      }\
      .hero h1 {\
        margin: 0 0 6px 0;\
        font-size: 2rem;\
        font-weight: 800;\
      }\
      .hero p {\
        margin: 0;\
        color: rgba(255,255,255,0.82);\
        max-width: 880px;\
      }\
      .hero-stats {\
        display: grid;\
        grid-template-columns: repeat(3, minmax(0, 1fr));\
        gap: 12px;\
        margin-top: 18px;\
      }\
      .hero-stat {\
        background: rgba(255,255,255,0.08);\
        border: 1px solid rgba(255,255,255,0.12);\
        border-radius: 18px;\
        padding: 14px 16px;\
      }\
      .hero-stat-label {\
        color: rgba(255,255,255,0.7);\
        font-size: 0.78rem;\
        text-transform: uppercase;\
        letter-spacing: 0.08em;\
        font-weight: 700;\
      }\
      .hero-stat-value {\
        margin-top: 6px;\
        font-size: 1.35rem;\
        font-weight: 800;\
      }\
      .hero-actions {\
        display: flex;\
        gap: 10px;\
        flex-wrap: wrap;\
        margin-top: 14px;\
      }\
      .hero-pill {\
        display: inline-flex;\
        align-items: center;\
        gap: 8px;\
        padding: 8px 12px;\
        border-radius: 999px;\
        background: rgba(255,255,255,0.10);\
        color: white;\
        font-size: 0.92rem;\
      }\
      .year-bar {\
        background: white;\
        border: 1px solid #e5e7eb;\
        border-radius: 20px;\
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);\
        padding: 20px 24px 10px 24px;\
        margin-bottom: 18px;\
      }\
      .year-bar .irs-bar, .year-bar .irs-single, .year-bar .irs-from, .year-bar .irs-to {\
        background: var(--blue-600);\
        border-color: var(--blue-600);\
      }\
      .year-bar .irs-handle > i:first-child {\
        background: var(--blue-600);\
      }\
      .sidebar-card, .panel-card {\
        background: white;\
        border: 1px solid #e5e7eb;\
        border-radius: 20px;\
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);\
      }\
      .sidebar-card {\
        padding: 18px 16px 16px 16px;\
        position: sticky;\
        top: 16px;\
      }\
      .panel-card {\
        padding: 18px;\
        margin-bottom: 16px;\
      }\
      .card-grid {\
        display: flex;\
        flex-wrap: wrap;\
        gap: 16px;\
        margin: 0 0 16px 0;\
      }\
      .card-grid > [class*='col-'] {\
        padding-left: 0;\
        padding-right: 0;\
      }\
      .kpi-col {\
        width: calc(25% - 12px);\
      }\
      .chart-col-wide {\
        width: calc(62% - 8px);\
      }\
      .chart-col-narrow {\
        width: calc(38% - 8px);\
      }\
      .split-col {\
        width: calc(50% - 8px);\
      }\
      .section-title {\
        font-size: 1.05rem;\
        font-weight: 800;\
        margin: 0 0 10px 0;\
      }\
      .section-subtitle {\
        color: #6b7280;\
        margin-bottom: 14px;\
      }\
      .kpi-card {\
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);\
        border: 1px solid #e5e7eb;\
        border-radius: 18px;\
        padding: 16px;\
        min-height: 112px;\
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);\
      }\
      .kpi-label {\
        font-size: 0.82rem;\
        color: #6b7280;\
        text-transform: uppercase;\
        letter-spacing: 0.06em;\
        font-weight: 700;\
      }\
      .kpi-value {\
        font-size: 1.9rem;\
        line-height: 1.1;\
        font-weight: 800;\
        margin-top: 8px;\
        color: #111827;\
      }\
      .kpi-value-compact {\
        font-size: 1.15rem;\
        line-height: 1.35;\
        overflow-wrap: anywhere;\
      }\
      .kpi-note {\
        margin-top: 8px;\
        color: #6b7280;\
        font-size: 0.88rem;\
      }\
      .overview-highlight {\
        background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%);\
        border: 1px solid #bfdbfe;\
        color: #1d4ed8;\
        padding: 14px 16px;\
        border-radius: 16px;\
        margin: 0 0 16px 0;\
      }\
      .shiny-input-container {\
        margin-bottom: 12px;\
      }\
      .control-label {\
        font-weight: 700;\
        color: #111827;\
      }\
      .form-control, .selectize-input, .selectize-dropdown, .input-group .form-control {\
        border-radius: 12px !important;\
      }\
      .btn {\
        border-radius: 12px;\
        font-weight: 700;\
      }\
      .btn-primary {\
        background: #2563eb;\
        border-color: #2563eb;\
      }\
      .btn-default {\
        background: #ffffff;\
      }\
      .hr-soft {\
        border: 0;\
        height: 1px;\
        background: linear-gradient(90deg, rgba(229,231,235,0), rgba(229,231,235,1), rgba(229,231,235,0));\
        margin: 18px 0;\
      }\
      .table > thead > tr > th {\
        background: #f8fafc;\
      }\
      .tabbable > .nav-tabs > li > a {\
        border-radius: 12px 12px 0 0;\
        font-weight: 700;\
        color: #4b5563;\
      }\
      .tabbable > .nav-tabs > li.active > a, .tabbable > .nav-tabs > li.active > a:focus, .tabbable > .nav-tabs > li.active > a:hover {\
        color: var(--blue-600);\
      }\
      .tab-content {\
        padding-top: 18px;\
      }\
      .insight-box {\
        background: #eff6ff;\
        border: 1px solid #bfdbfe;\
        color: #1e3a8a;\
        padding: 14px 16px;\
        border-radius: 16px;\
        margin: 10px 0 16px 0;\
      }\
      .table-toolbar {\
        display: flex;\
        gap: 18px;\
        align-items: end;\
        flex-wrap: wrap;\
        margin-bottom: 8px;\
      }\
      .table-toolbar .shiny-input-container {\
        margin-bottom: 0;\
      }\
      .table-summary {\
        color: var(--text-muted);\
        margin-bottom: 14px;\
      }\
      .table-frame {\
        overflow-x: auto;\
        border: 1px solid var(--line-soft);\
        border-radius: 18px;\
      }\
      .table {\
        margin-bottom: 0;\
      }\
      .table > thead > tr > th, .table > tbody > tr > td {\
        padding: 12px 14px !important;\
        vertical-align: middle !important;\
      }\
      .footer-note {\
        color: #6b7280;\
        font-size: 0.9rem;\
      }\
      @media (max-width: 991px) {\
        .hero-stats {\
          grid-template-columns: 1fr;\
        }\
        .sidebar-card {\
          position: static;\
        }\
        .kpi-col, .chart-col-wide, .chart-col-narrow, .split-col {\
          width: 100%;\
        }\
      }\
    "))
  ),
  div(class = "app-shell",
      div(class = "hero",
          h1(icon("gamepad"), "Video Game Sales Explorer"),
          p(sprintf(
            "Explore worldwide game sales from %s to %s with a cleaner, more polished dashboard. Filter by year and %s, then compare sales trends, category leaders, and score relationships.",
            min_year, max_year, filter_story
          )),
          div(class = "hero-actions",
              div(class = "hero-pill", icon("chart-line"), "Trends + rankings"),
              div(class = "hero-pill", icon("sliders"), "Interactive filters"),
              div(class = "hero-pill", icon("download"), "Export filtered data"),
              div(class = "hero-pill", icon("user"), "Built by Randy Mattoka")
          ),
          div(class = "hero-stats",
              div(class = "hero-stat",
                  div(class = "hero-stat-label", "Rows in dataset"),
                  div(class = "hero-stat-value", comma(dataset_rows))
              ),
              div(class = "hero-stat",
                  div(class = "hero-stat-label", "Unique game titles"),
                  div(class = "hero-stat-value", comma(dataset_titles))
              ),
              div(class = "hero-stat",
                  div(class = "hero-stat-label", if (!is.na(dataset_platforms)) "Platforms covered" else "Years covered"),
                  div(class = "hero-stat-value", if (!is.na(dataset_platforms)) comma(dataset_platforms) else paste0(min_year, "-", max_year))
              )
          )
      ),
      div(class = "year-bar",
          div(class = "section-title", icon("calendar"), " Release Year Range"),
          div(class = "section-subtitle", "Use the full-width slider to focus the dashboard on a specific era."),
          sliderInput("year_range", NULL, min = min_year, max = max_year, value = c(min_year, max_year), sep = "", width = "100%")
      ),
      fluidRow(
        column(
          3,
          div(class = "sidebar-card",
              div(class = "section-title", icon("sliders"), " Filters"),
              div(class = "section-subtitle", "Narrow the dataset without losing the story."),
              uiOutput("platform_filter"),
              uiOutput("genre_filter"),
              uiOutput("publisher_filter"),
              uiOutput("developer_filter"),
              uiOutput("rating_filter"),
              fluidRow(
                column(6, actionButton("reset_filters", "Reset", width = "100%")),
                column(6, downloadButton("download_filtered", "CSV", width = "100%"))
              ),
              hr(class = "hr-soft"),
              div(class = "footer-note", icon("circle-info"), " Tip: use the year slider and just one or two filters to get the cleanest story for screenshots.")
          )
        ),
        column(
          9,
          div(class = "panel-card",
              tabsetPanel(
                tabPanel(
                  "Overview",
                  div(class = "section-title", icon("gauge-high"), " At a glance"),
                  div(class = "section-subtitle", textOutput("summary_text")),
                  uiOutput("overview_highlight"),
                  div(
                    class = "card-grid",
                    div(class = "kpi-col", div(class = "kpi-card", div(class = "kpi-label", "Filtered games"), div(class = "kpi-value", textOutput("kpi_count")), div(class = "kpi-note", "Matching rows in the current filter set"))),
                    div(class = "kpi-col", div(class = "kpi-card", div(class = "kpi-label", "Total global sales"), div(class = "kpi-value", textOutput("kpi_global")), div(class = "kpi-note", "Combined worldwide sales for the filtered slice"))),
                    div(class = "kpi-col", div(class = "kpi-card", div(class = "kpi-label", "Average critic score"), div(class = "kpi-value", textOutput("kpi_critic")), div(class = "kpi-note", "Only shown when the dataset includes a critic score column"))),
                    div(class = "kpi-col", div(class = "kpi-card", div(class = "kpi-label", "Top title by sales"), div(class = "kpi-value kpi-value-compact", textOutput("kpi_top_title")), div(class = "kpi-note", textOutput("kpi_top_title_note"))))
                  ),
                  div(
                    class = "card-grid",
                    div(class = "chart-col-wide",
                           div(class = "panel-card",
                               div(class = "section-title", "Sales over time"),
                               div(class = "section-subtitle", "See how global sales change across the filtered release years."),
                               plotOutput("year_plot", height = 320)
                           )
                    ),
                    div(class = "chart-col-narrow",
                           div(class = "panel-card",
                               div(class = "section-title", "Score vs. sales"),
                               div(class = "section-subtitle", "Check whether higher critic scores tend to correspond with stronger sales."),
                               plotOutput("sales_scatter", height = 320)
                           )
                    )
                  )
                ),
                tabPanel(
                  "Breakdowns",
                  div(
                    class = "card-grid",
                    div(class = "split-col",
                           div(class = "panel-card",
                               div(class = "section-title", "Top genres"),
                               div(class = "section-subtitle", "Genres ranked by total global sales."),
                               plotOutput("genre_plot", height = 340)
                           )
                    ),
                    div(class = "split-col",
                           div(class = "panel-card",
                               div(class = "section-title", "Top platforms"),
                               div(class = "section-subtitle", "Platforms ranked by total global sales."),
                               plotOutput("platform_plot", height = 340)
                           )
                    )
                  ),
                  div(class = "insight-box", uiOutput("insight_box"))
                ),
                tabPanel(
                  "Data table",
                  div(class = "section-title", icon("table"), " Top games in the filtered set"),
                  div(class = "section-subtitle", "The table updates with your filters and selected sales ranking."),
                  div(class = "panel-card",
                      div(class = "table-toolbar",
                          textInput("title_search", "Search title", placeholder = "Type a game title", width = "280px"),
                          selectInput(
                            "metric",
                            "Sort top games by",
                            choices = metric_choices,
                            selected = "global",
                            width = "280px"
                          ),
                          numericInput("n_top", "Top N games", value = 10, min = 5, max = 50, step = 1, width = "220px")
                      ),
                      div(class = "table-summary", textOutput("table_summary")),
                      div(class = "table-frame", tableOutput("top_table"))
                  ),
                  hr(class = "hr-soft"),
                  div(class = "footer-note", "Export the full filtered dataset with the CSV button in the sidebar.")
                ),
                tabPanel(
                  "About",
                  div(class = "panel-card",
                      div(class = "section-title", "How to use it"),
                      tags$ul(
                        tags$li("Start with the year slider to narrow the era you want to discuss."),
                        tags$li("Use one or two filters at a time for a cleaner visual story."),
                        tags$li("The Overview tab is best for screenshots and demos."),
                        tags$li("The Data table tab is useful when you want exact titles and values." )
                      ),
                      div(class = "section-title", style = "margin-top: 18px;", "Extras"),
                      tags$ul(
                        tags$li(sprintf("Interactive filtering across year plus %s.", filter_story)),
                        tags$li("Multiple coordinated charts plus a downloadable filtered CSV."),
                        tags$li("Deployed on shinyapps.io and easy to update with new versions.")
                      )
                  )
                )
              )
          )
        )
      )
  )
)

server <- function(input, output, session) {
  output$platform_filter <- renderUI({
    req(!is.na(platform_col))
    selectizeInput("platform", "Platform", choices = NULL, selected = "All", options = list(placeholder = "All platforms"))
  })
  
  output$genre_filter <- renderUI({
    req(!is.na(genre_col))
    selectizeInput("genre", "Genre", choices = NULL, selected = "All", options = list(placeholder = "All genres"))
  })
  
  output$publisher_filter <- renderUI({
    req(!is.na(pub_col))
    selectizeInput("publisher", "Publisher", choices = NULL, selected = "All", options = list(placeholder = "All publishers"))
  })
  
  output$developer_filter <- renderUI({
    req(!is.na(dev_col))
    selectizeInput("developer", "Developer", choices = NULL, selected = "All", options = list(placeholder = "All developers"))
  })
  
  output$rating_filter <- renderUI({
    req(!is.na(rating_col))
    selectizeInput("rating", "Rating", choices = NULL, selected = "All", options = list(placeholder = "All ratings"))
  })
  
  observe({
    if (!is.na(platform_col)) {
      updateSelectizeInput(session, "platform", choices = platform_choices, selected = "All", server = TRUE)
    }
    if (!is.na(genre_col)) {
      updateSelectizeInput(session, "genre", choices = genre_choices, selected = "All", server = TRUE)
    }
    if (!is.na(pub_col)) {
      updateSelectizeInput(session, "publisher", choices = publisher_choices, selected = "All", server = TRUE)
    }
    if (!is.na(dev_col)) {
      updateSelectizeInput(session, "developer", choices = developer_choices, selected = "All", server = TRUE)
    }
    if (!is.na(rating_col)) {
      updateSelectizeInput(session, "rating", choices = rating_choices, selected = "All", server = TRUE)
    }
  })

  observeEvent(input$reset_filters, {
    updateSliderInput(session, "year_range", value = c(min_year, max_year))
    if (!is.na(platform_col)) updateSelectizeInput(session, "platform", selected = "All")
    if (!is.na(genre_col)) updateSelectizeInput(session, "genre", selected = "All")
    if (!is.na(pub_col)) updateSelectizeInput(session, "publisher", selected = "All")
    if (!is.na(dev_col)) updateSelectizeInput(session, "developer", selected = "All")
    if (!is.na(rating_col)) updateSelectizeInput(session, "rating", selected = "All")
    updateSelectInput(session, "metric", selected = "global")
    updateNumericInput(session, "n_top", value = 10)
  })
  
  filtered <- reactive({
    df <- clean %>%
      filter(!is.na(.data[[year_col]])) %>%
      filter(.data[[year_col]] >= input$year_range[1], .data[[year_col]] <= input$year_range[2])
    
    if (!is.na(platform_col) && !is.null(input$platform) && input$platform != "All") df <- df %>% filter(.data[[platform_col]] == input$platform)
    if (!is.na(genre_col) && !is.null(input$genre) && input$genre != "All") df <- df %>% filter(.data[[genre_col]] == input$genre)
    if (!is.na(pub_col) && !is.null(input$publisher) && input$publisher != "All") df <- df %>% filter(.data[[pub_col]] == input$publisher)
    if (!is.na(dev_col) && !is.null(input$developer) && input$developer != "All") df <- df %>% filter(.data[[dev_col]] == input$developer)
    if (!is.na(rating_col) && !is.null(input$rating) && input$rating != "All") df <- df %>% filter(.data[[rating_col]] == input$rating)
    
    df
  })

  top_seller <- reactive({
    df <- filtered()
    if (nrow(df) == 0) return(NULL)
    df %>%
      arrange(desc(.data[[global_col]]), .data[[name_col]]) %>%
      slice_head(n = 1)
  })
  
  output$summary_text <- renderText({
    df <- filtered()
    year_txt <- paste0(input$year_range[1], "–", input$year_range[2])
    if (nrow(df) == 0) {
      return(paste0("No games match the current filters for ", year_txt, ". Try widening the year range or clearing one filter."))
    }
    paste0(comma(nrow(df)), " records shown from ", year_txt, ".")
  })

  output$overview_highlight <- renderUI({
    df <- filtered()
    if (nrow(df) == 0) return(NULL)

    top_game <- top_seller()
    title_txt <- top_game[[name_col]][1]
    sales_txt <- fmt_sales(top_game[[global_col]][1])
    platform_txt <- if (!is.na(platform_col) && platform_col %in% names(top_game)) top_game[[platform_col]][1] else NULL
    publisher_txt <- if (!is.na(pub_col) && pub_col %in% names(top_game)) top_game[[pub_col]][1] else NULL

    HTML(paste0(
      "<strong>Snapshot:</strong> The current slice is led by <strong>", title_txt, "</strong>",
      " at <strong>", sales_txt, "</strong>",
      if (!is.null(platform_txt)) paste0(" on <strong>", platform_txt, "</strong>") else "",
      if (!is.null(publisher_txt)) paste0(", published by <strong>", publisher_txt, "</strong>") else "",
      "."
    ))
  })
  
  output$kpi_count <- renderText({
    comma(nrow(filtered()))
  })
  
  output$kpi_global <- renderText({
    df <- filtered()
    if (nrow(df) == 0) return("0M")
    fmt_sales(sum(df[[global_col]], na.rm = TRUE))
  })
  
  output$kpi_critic <- renderText({
    df <- filtered()
    if (is.na(critic_col) || nrow(df) == 0) return("N/A")
    v <- mean(df[[critic_col]], na.rm = TRUE)
    if (is.nan(v)) "N/A" else number(v, accuracy = 0.1)
  })

  output$kpi_top_title <- renderText({
    top_game <- top_seller()
    if (is.null(top_game) || nrow(top_game) == 0) return("No data")
    top_game[[name_col]][1]
  })

  output$kpi_top_title_note <- renderText({
    top_game <- top_seller()
    if (is.null(top_game) || nrow(top_game) == 0) return("Adjust the filters to surface a top title.")
    note_bits <- c(fmt_sales(top_game[[global_col]][1]))
    if (!is.na(platform_col) && platform_col %in% names(top_game)) {
      note_bits <- c(note_bits, top_game[[platform_col]][1])
    }
    paste(note_bits, collapse = " | ")
  })
  
  output$insight_box <- renderUI({
    df <- filtered()
    if (nrow(df) == 0) {
      return(HTML("<strong>No data.</strong> Try broadening the filters to surface trends and rankings."))
    }
    
    top_genre <- if (!is.na(genre_col)) {
      df %>% group_by(.data[[genre_col]]) %>% summarise(v = sum(.data[[global_col]], na.rm = TRUE), .groups = "drop") %>% arrange(desc(v)) %>% slice(1) %>% pull(1)
    } else {
      NA_character_
    }
    
    top_platform <- if (!is.na(platform_col)) {
      df %>% group_by(.data[[platform_col]]) %>% summarise(v = sum(.data[[global_col]], na.rm = TRUE), .groups = "drop") %>% arrange(desc(v)) %>% slice(1) %>% pull(1)
    } else {
      NA_character_
    }

    top_publisher <- if (!is.na(pub_col)) {
      df %>% group_by(.data[[pub_col]]) %>% summarise(v = sum(.data[[global_col]], na.rm = TRUE), .groups = "drop") %>% arrange(desc(v)) %>% slice(1) %>% pull(1)
    } else {
      NA_character_
    }

    top_game <- top_seller()
    
    html <- paste0(
      "<strong>Quick insight:</strong> ",
      if (!is.na(top_genre)) paste0("<span>Top genre here is <strong>", top_genre, "</strong>.</span> ") else "",
      if (!is.na(top_platform)) paste0("<span>Top platform here is <strong>", top_platform, "</strong>.</span> ") else "",
      if (!is.na(top_publisher)) paste0("<span>The leading publisher is <strong>", top_publisher, "</strong>.</span> ") else "",
      if (!is.null(top_game) && nrow(top_game) > 0) paste0("<span>Best-selling title in view: <strong>", top_game[[name_col]][1], "</strong> at <strong>", fmt_sales(top_game[[global_col]][1]), "</strong>.</span>") else ""
    )
    HTML(html)
  })
  
  output$year_plot <- renderPlot({
    df <- filtered()
    validate(need(nrow(df) > 0, "No games match the current filters."))
    
    yearly <- df %>%
      filter(!is.na(.data[[year_col]])) %>%
      group_by(year = .data[[year_col]]) %>%
      summarise(global_sales = sum(.data[[global_col]], na.rm = TRUE), .groups = "drop")
    
    ggplot(yearly, aes(x = year, y = global_sales)) +
      geom_area(fill = "#dbeafe", alpha = 0.85) +
      geom_line(linewidth = 1, color = "#2563eb") +
      geom_point(size = 2, color = "#1d4ed8") +
      scale_y_continuous(labels = label_number(accuracy = 1, suffix = "M")) +
      scale_x_continuous(breaks = pretty_breaks(n = 8)) +
      labs(x = NULL, y = "Global sales (M)") +
      plot_theme()
  })
  
  output$genre_plot <- renderPlot({
    df <- filtered()
    validate(need(nrow(df) > 0, "No games match the current filters."))
    validate(need(!is.na(genre_col), "Genre column not found in this dataset."))
    
    genre_summary <- df %>%
      group_by(genre = .data[[genre_col]]) %>%
      summarise(global_sales = sum(.data[[global_col]], na.rm = TRUE), .groups = "drop") %>%
      arrange(desc(global_sales)) %>%
      slice_head(n = 12)
    
    ggplot(genre_summary, aes(x = reorder(genre, global_sales), y = global_sales)) +
      geom_col(fill = "#2563eb") +
      coord_flip() +
      scale_y_continuous(labels = label_number(accuracy = 1, suffix = "M")) +
      labs(x = NULL, y = "Global sales (M)") +
      plot_theme()
  })
  
  output$platform_plot <- renderPlot({
    df <- filtered()
    validate(need(nrow(df) > 0, "No games match the current filters."))
    validate(need(!is.na(platform_col), "Platform column not found in this dataset."))
    
    platform_summary <- df %>%
      group_by(platform = .data[[platform_col]]) %>%
      summarise(global_sales = sum(.data[[global_col]], na.rm = TRUE), .groups = "drop") %>%
      arrange(desc(global_sales)) %>%
      slice_head(n = 12)
    
    ggplot(platform_summary, aes(x = reorder(platform, global_sales), y = global_sales)) +
      geom_col(fill = "#0f766e") +
      coord_flip() +
      scale_y_continuous(labels = label_number(accuracy = 1, suffix = "M")) +
      labs(x = NULL, y = "Global sales (M)") +
      plot_theme()
  })
  
  output$sales_scatter <- renderPlot({
    df <- filtered()
    validate(need(nrow(df) > 0, "No games match the current filters."))
    validate(need(!is.na(critic_col), "Critic score column not found in this dataset."))
    
    ggplot(df, aes(x = .data[[critic_col]], y = .data[[global_col]])) +
      geom_point(alpha = 0.28, color = "#7c3aed", size = 2) +
      geom_smooth(se = FALSE, method = "lm", color = "#111827", linewidth = 1) +
      scale_y_continuous(labels = label_number(accuracy = 1, suffix = "M")) +
      labs(x = "Critic score", y = "Global sales (M)") +
      plot_theme()
  })

  output$table_summary <- renderText({
    df <- filtered()
    if (!is.null(input$title_search) && nzchar(trimws(input$title_search))) {
      df <- df %>% filter(grepl(input$title_search, .data[[name_col]], ignore.case = TRUE))
    }
    if (nrow(df) == 0) return("No rows to display for the current filter set.")
    paste0(
      "Showing ", min(input$n_top, nrow(df)), " of ", comma(nrow(df)),
      " filtered rows",
      if (!is.null(input$title_search) && nzchar(trimws(input$title_search))) paste0(" matching \"", input$title_search, "\"") else "",
      ", sorted by ", sales_metric_label(input$metric), "."
    )
  })
  
  output$top_table <- renderTable({
    df <- filtered()
    if (!is.null(input$title_search) && nzchar(trimws(input$title_search))) {
      df <- df %>% filter(grepl(input$title_search, .data[[name_col]], ignore.case = TRUE))
    }
    if (nrow(df) == 0) {
      return(data.frame(Message = "No games match the current filters."))
    }
    
    sort_col <- switch(
      input$metric,
      global = global_col,
      na = na_col,
      eu = eu_col,
      jp = jp_col,
      other = other_col,
      critic = critic_col,
      year_desc = year_col,
      year_asc = year_col,
      title_asc = name_col,
      global_col
    )
    if (is.na(sort_col)) sort_col <- global_col
    
    cols <- unique(na.omit(c(name_col, year_col, platform_col, genre_col, pub_col, dev_col, rating_col, sort_col, global_col, critic_col, user_col)))

    table_df <- df %>%
      select(all_of(cols)) %>%
      {
        if (input$metric == "year_asc") {
          arrange(., .data[[sort_col]], .data[[name_col]])
        } else if (input$metric == "title_asc") {
          arrange(., .data[[sort_col]])
        } else {
          arrange(., desc(.data[[sort_col]]), .data[[name_col]])
        }
      } %>%
      slice_head(n = input$n_top)

    names(table_df) <- vapply(names(table_df), display_col_label, character(1))
    table_df
  }, striped = TRUE, hover = TRUE, digits = 2)
  
  output$download_filtered <- downloadHandler(
    filename = function() {
      paste0("video_game_sales_filtered_", Sys.Date(), ".csv")
    },
    content = function(file) {
      write.csv(filtered(), file, row.names = FALSE)
    }
  )
}

shinyApp(ui, server)
