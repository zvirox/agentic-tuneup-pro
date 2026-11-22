pub mod service;
pub mod validator;

use service::AgenticTuneupHelper;
use zbus::connection::Builder;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Agentic Tuneup Pro Polkit Helper Daemon (atpd-helper) initializing...");

    let helper = AgenticTuneupHelper;
    let _conn = Builder::system()?
        .name("in.zvirox.AgenticTuneupHelper")?
        .serve_at("/in/zvirox/AgenticTuneupHelper", helper)?
        .build()
        .await?;

    println!("atpd-helper successfully registered on system D-Bus. Serving requests...");

    // Wait indefinitely
    std::future::pending::<()>().await;
    Ok(())
}
