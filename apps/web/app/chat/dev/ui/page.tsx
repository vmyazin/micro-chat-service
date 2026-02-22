import { Button } from '../../../../components/Button';
import { SidebarItem } from '../../../../components/SidebarItem';

export default function DevUIPage() {
  return (
    <main className="demo-page p-8 max-w-4xl mx-auto space-y-12">
      <header className="demo-header border-b pb-4 mb-8">
        <h1 className="demo-title text-3xl font-bold tracking-tight mb-2">
          UI Component Library
        </h1>
        <p className="demo-description text-gray-500 dark:text-gray-400">
          Minimal demonstration and documentation of shared components.
        </p>
      </header>

      <section className="demo-section space-y-6">
        <header className="section-header">
          <h2 className="section-title text-2xl font-semibold mb-2">Button</h2>
          <p className="section-description text-sm text-gray-500 mb-4">
            The core button primitive with multiple variants and sizes.
          </p>
        </header>

        <article className="demo-container bg-(--surface-elevated) border border-(--border-base) rounded-lg p-6 space-y-8">
          <div className="demo-group space-y-4">
            <h3 className="group-title text-lg font-medium text-(--text-primary)">
              Variants
            </h3>
            <div className="group-content flex flex-wrap gap-4 items-center">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="colorful">Colorful</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="success">Success</Button>
              <Button variant="warning">Warning</Button>
            </div>
          </div>

          <div className="demo-group space-y-4">
            <h3 className="group-title text-lg font-medium text-(--text-primary)">
              Sizes
            </h3>
            <div className="group-content flex flex-wrap gap-4 items-center">
              <Button size="sm" variant="outline">
                Small
              </Button>
              <Button size="md" variant="outline">
                Medium
              </Button>
              <Button size="lg" variant="outline">
                Large
              </Button>
            </div>
          </div>

          <div className="demo-group space-y-4">
            <h3 className="group-title text-lg font-medium text-(--text-primary)">
              States
            </h3>
            <div className="group-content flex flex-wrap gap-4 items-center">
              <Button disabled>Disabled Primary</Button>
              <Button variant="outline" disabled>
                Disabled Outline
              </Button>
            </div>
          </div>
        </article>
      </section>

      <section className="demo-section space-y-6">
        <header className="section-header">
          <h2 className="section-title text-2xl font-semibold mb-2">
            SidebarItem
          </h2>
          <p className="section-description text-sm text-gray-500 mb-4">
            Component used for list navigation items within the sidebar.
          </p>
        </header>

        <article className="demo-container bg-(--surface-elevated) border border-(--border-base) rounded-lg p-6 space-y-4">
          <div className="demo-group max-w-sm space-y-2">
            <SidebarItem title="Active Item" isActive />
            <SidebarItem
              title="Inactive Item"
              description="With a description below"
              isActive={false}
            />
            <SidebarItem
              title="Long Title Item that truncates if it gets too long"
              isActive={false}
            />
          </div>
        </article>
      </section>
    </main>
  );
}
