//! pdfcrop Web Application
//!
//! This is a thin wrapper that re-exports the WASM bindings from the main pdfcrop crate.
//! All the heavy lifting is done in the parent crate's src/wasm.rs module.

// Re-export all WASM bindings from pdfcrop
pub use pdfcrop::wasm::*;
