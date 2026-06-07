import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Pool Service Admin</h1>

      <div className="mt-6 space-y-2">
        <div>
          <Link className="underline" href="/customers">
            Go to Customers
          </Link>
        </div>

        <div>
          <Link className="underline" href="/locations">
            Go to Locations
          </Link>
        </div>

        <div>
          <Link className="underline" href="/routes">
            Go to Route Planner
          </Link>
        </div>

        <div>
          <Link className="underline" href="/techs">
            Go to Techs
          </Link>
        </div>

        <div>
          <Link className="underline" href="/vendors">
            Go to Vendors
          </Link>
        </div>

        <div>
          <Link className="underline" href="/reference/chemistry">
            Pool Chemistry Reference
          </Link>
        </div>
      </div>
    </main>
  );
}
