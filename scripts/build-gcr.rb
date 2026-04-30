#!/usr/bin/env ruby
# frozen_string_literal: true

# Build .gcr files for all datasets in datasets.yml
# Usage: ruby scripts/build-gcr.rb [output_dir]

require "yaml"
require "fileutils"

# Load glossarist gem
$LOAD_PATH.unshift(File.join(__dir__, "..", "..", "glossarist-ruby", "lib"))
require "glossarist"

BROWSER_ROOT = File.join(__dir__, "..")
DATASETS_DIR = File.join(BROWSER_ROOT, ".datasets")

def build_gcr(dataset_config, output_dir)
  id = dataset_config["id"]
  source_dir = File.join(DATASETS_DIR, id)
  concepts_dir = File.join(source_dir, "concepts")
  output_path = File.join(output_dir, "#{id}.gcr")

  unless File.directory?(concepts_dir)
    warn "  Skipping #{id}: no concepts/ directory"
    return
  end

  # Read register.yaml
  register_path = File.join(source_dir, "register.yaml")
  register_data = nil
  if File.exist?(register_path)
    begin
      register_data = YAML.safe_load_file(register_path, permitted_classes: [Date, Time])
    rescue Psych::SyntaxError => e
      warn "  Warning: register.yaml parse error: #{e.message}"
    end
  end

  # Read and migrate concepts
  files = Dir.glob(File.join(concepts_dir, "*.yaml"))
  puts "  Reading #{files.length} concepts..."

  concepts = []
  ref_maps = {
    ref_prefix_map: { "IEV" => "iev" },
    urn_standard_map: { "14812" => "isotc204" },
  }

  errors = 0
  files.each do |file|
    hash = YAML.safe_load_file(file, permitted_classes: [Date, Time])
    next unless hash&.dig("termid")

    # Apply schema migration (v0 → v1)
    migration = Glossarist::SchemaMigration.new(
      hash,
      from_version: "0",
      to_version: Glossarist::SchemaMigration::CURRENT_SCHEMA_VERSION,
      ref_maps: ref_maps,
    )
    migrated = migration.migrate
    concepts << migrated
  rescue => e
    errors += 1
    warn "  Error: #{File.basename(file)}: #{e.message}" if errors <= 3
  end

  puts "  Migrated #{concepts.length} concepts (#{errors} errors)"

  # Build metadata
  options = {
    title: dataset_config["title"],
    description: dataset_config["description"],
    owner: dataset_config["owner"],
    tags: dataset_config["tags"],
  }
  metadata = Glossarist::GcrMetadata.from_concepts(concepts, register_data: register_data, options: options)

  # Add register schema_version
  register_data ||= {}
  register_data["schema_version"] = Glossarist::SchemaMigration::CURRENT_SCHEMA_VERSION

  # Create .gcr
  FileUtils.mkdir_p(output_dir)
  Glossarist::GcrPackage.create(
    concepts: concepts,
    metadata: metadata,
    register_yaml: register_data,
    output_path: output_path,
  )

  puts "  Created #{output_path} (#{concepts.length} concepts)"
end

# Main
config = YAML.safe_load_file(File.join(BROWSER_ROOT, "datasets.yml"))
output_dir = ARGV[0] || File.join(BROWSER_ROOT, ".gcr")

puts "Building GCR files...\n\n"

config["datasets"].each do |ds|
  puts "#{ds['id']}:"
  build_gcr(ds, output_dir)
  puts
end

puts "Done."
