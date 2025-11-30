-- Enable Row Level Security and tenant-based policies

-- Helper: function to get current tenant id from GUC
CREATE OR REPLACE FUNCTION app.current_tenant_id() RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- List of tables that are tenant-scoped
DO $$
DECLARE
  t regclass;
  tbls text[] := ARRAY[
    'public."Tenant"',
    'public."User"',
    'public."UnitOfMeasure"',
    'public."Location"',
    'public."Product"',
    'public."ProductBatch"',
    'public."StockQuant"',
    'public."Customer"',
    'public."Invoice"',
    'public."InvoiceItem"',
    'public."Transaction"',
    'public."Member"',
    'public."Account"',
    'public."Loan"',
    'public."LoanGuarantor"',
    'public."Session"'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    t := tbl::regclass;

    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);

    -- Select policy
    EXECUTE format($p$
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = %L
            AND tablename = %L
            AND policyname = %L
        ) THEN
          EXECUTE $q$
            CREATE POLICY tenant_isolation_select ON %s
            USING ("tenantId" = app.current_tenant_id());
          $q$;
        END IF;
      END;
      $$;
    $p$, 'public', split_part(tbl, '."', 2)::text::regclass::text, 'tenant_isolation_select', t);

    -- Insert policy
    EXECUTE format($p$
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = %L
            AND tablename = %L
            AND policyname = %L
        ) THEN
          EXECUTE $q$
            CREATE POLICY tenant_isolation_insert ON %s
            FOR INSERT WITH CHECK ("tenantId" = app.current_tenant_id());
          $q$;
        END IF;
      END;
      $$;
    $p$, 'public', split_part(tbl, '."', 2)::text::regclass::text, 'tenant_isolation_insert', t);

    -- Update policy
    EXECUTE format($p$
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = %L
            AND tablename = %L
            AND policyname = %L
        ) THEN
          EXECUTE $q$
            CREATE POLICY tenant_isolation_update ON %s
            FOR UPDATE USING ("tenantId" = app.current_tenant_id())
            WITH CHECK ("tenantId" = app.current_tenant_id());
          $q$;
        END IF;
      END;
      $$;
    $p$, 'public', split_part(tbl, '."', 2)::text::regclass::text, 'tenant_isolation_update', t);

    -- Delete policy
    EXECUTE format($p$
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = %L
            AND tablename = %L
            AND policyname = %L
        ) THEN
          EXECUTE $q$
            CREATE POLICY tenant_isolation_delete ON %s
            FOR DELETE USING ("tenantId" = app.current_tenant_id());
          $q$;
        END IF;
      END;
      $$;
    $p$, 'public', split_part(tbl, '."', 2)::text::regclass::text, 'tenant_isolation_delete', t);
  END LOOP;
END;
$$;